import { useState, useCallback } from 'react';

interface UseDragAndDropFileProps {
  handleDropFile: (file: File) => void;
}

export const useDragAndDropFile = ({ handleDropFile }: UseDragAndDropFileProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleDropFile(file);
    }
  }, [handleDropFile]);

  return {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};