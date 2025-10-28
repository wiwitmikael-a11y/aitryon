import JSZip from 'jszip';
import type { AssetMetadata } from '../services/geminiService';
import type { BatchImageResult } from '../types';

interface Asset {
    id: string;
    type: 'photo' | 'video';
    prompt: string;
    status: 'pending' | 'generating' | 'polling' | 'complete' | 'failed';
    src?: string;
    metadata?: AssetMetadata;
}

function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-') // Replace multiple - with single -
        .replace(/^-+/, '') // Trim - from start of text
        .replace(/-+$/, ''); // Trim - from end of text
}

function escapeCsvField(field: string | undefined): string {
    if (field === undefined) return '';
    // Wrap in double quotes and escape existing double quotes
    return `"${field.replace(/"/g, '""')}"`;
}

export const createContentPackageZip = async (assets: Asset[]): Promise<void> => {
    const zip = new JSZip();
    const successfulAssets = assets.filter(a => a.status === 'complete' && a.src);

    const metadataCsvRows = [
        '"filename","type","title","description","tags","prompt"'
    ];

    // The order is preserved here, matching the generated assets order.
    for (const asset of successfulAssets) {
        try {
            const response = await fetch(asset.src!);
            const blob = await response.blob();
            
            const fileExtension = asset.type === 'photo' ? 'png' : 'mp4';
            const filename = `${slugify(asset.metadata?.title || asset.id)}.${fileExtension}`;

            zip.file(filename, blob);
            
            // Format tags with # and space separation for easy copy-paste.
            const tags = asset.metadata?.tags.map(t => `#${t}`).join(' ') || '';
            
            metadataCsvRows.push(
                [
                    escapeCsvField(filename),
                    escapeCsvField(asset.type),
                    escapeCsvField(asset.metadata?.title),
                    escapeCsvField(asset.metadata?.description),
                    escapeCsvField(tags),
                    escapeCsvField(asset.prompt)
                ].join(',')
            );

        } catch (e) {
            console.error(`Failed to fetch and add asset ${asset.id} to zip:`, e);
        }
    }
    
    // Save as .xls to be opened by Excel/Sheets directly into neat columns.
    zip.file("metadata.xls", metadataCsvRows.join('\n'));

    zip.generateAsync({ type: "blob" }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `AI-Creative-Package-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
};

export const createPhotoShootPackageZip = async (results: BatchImageResult[]): Promise<void> => {
    const zip = new JSZip();
    const successfulAssets = results.filter(r => r.status === 'complete' && r.src);

    for (let i = 0; i < successfulAssets.length; i++) {
        const asset = successfulAssets[i];
        try {
            const response = await fetch(asset.src!);
            const blob = await response.blob();
            const filename = `photo-shoot-image-${i + 1}.png`;
            zip.file(filename, blob);
        } catch (e) {
            console.error(`Failed to fetch and add asset ${asset.id} to zip:`, e);
        }
    }

    zip.generateAsync({ type: "blob" }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `AI-Photo-Shoot-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
};
