/**
 * @file Banner.tsx
 * @description Dismissible banner notification component.
 * Displays alert messages in different styles (info, success, warning, error).
 */

import React, { useState } from 'react';

/**
 * Props for the Banner component.
 * @interface BannerProps
 */
interface BannerProps {
  /** Message text to display */
  message: string;
  /** Banner type/severity level (defaults to 'info') */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Optional callback when banner is closed */
  onClose?: () => void;
}

/**
 * Banner notification component.
 * Displays a dismissible banner with color-coded severity.
 * 
 * @param props Component props
 * @returns Banner element or null if dismissed
 */
const Banner: React.FC<BannerProps> = ({ message, type = 'info', onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  // Define colors based on banner type
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
