import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-transparent mt-12 py-6">
      <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} AI Creative Suite. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;