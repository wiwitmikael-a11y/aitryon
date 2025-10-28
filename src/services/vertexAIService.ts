export const performVirtualTryOn = async (
  personImage: string,
  productImage: string
): Promise<{ resultImage: string }> => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personImage, productImage }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to generate image.');
  }
  
  return data;
};
