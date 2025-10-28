import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-800/50 border-t border-slate-700/50 mt-8 py-4">
      <div className="container mx-auto px-4 text-center text-slate-400">
        <p>&copy; {new Date().getFullYear()} AI Creative Suite. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
