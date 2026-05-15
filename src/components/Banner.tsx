import React, { useState } from 'react';

// Define the shape of the banner props
interface BannerProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose?: () => void;
}

const Banner: React.FC<BannerProps> = ({ message, type = 'info', onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  // Define colors based on type
  const bannerStyles = {
    info: 'bg-blue-100 text-blue-900',
    success: 'bg-green-100 text-green-900',
    warning: 'bg-yellow-100 text-yellow-900',
    error: 'bg-red-100 text-red-900',
  };

  return (
    <div className={`p-4 flex justify-between items-center ${bannerStyles[type]}`}>
      <span className="font-medium">{message}</span>
      <button onClick={handleClose} className="ml-4 font-bold">
        &times;
      </button>
    </div>
  );
};

export default Banner;
