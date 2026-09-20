export const uploadService = {
  toLocalPreview(file) {
    return {
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
      sizeMb: Number((file.size / 1024 / 1024).toFixed(2)),
    };
  },
};