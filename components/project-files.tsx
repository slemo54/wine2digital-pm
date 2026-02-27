"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileIcon, Download, Trash2, Upload, Loader2 } from "lucide-react";
import { useProjectFiles, useUploadFile, useDeleteFile } from "@/hooks/use-project-files";

interface ProjectFilesProps {
  projectId: string;
}

export function ProjectFiles({ projectId }: ProjectFilesProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const { data, isLoading } = useProjectFiles(projectId, page, pageSize);
  const files = data?.files || [];
  const total = data?.total || 0;

  const uploadMutation = useUploadFile();
  const deleteMutation = useDeleteFile();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      await uploadMutation.mutateAsync({ file, projectId });
      // Reset page to 1 after successful upload
      setPage(1);
    } catch (error) {
      // Error is already handled by the mutation's onError
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    deleteMutation.mutate({ fileId, projectId });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  const hasMore = files.length < total;

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle>Project Files</CardTitle>
        <div>
          <Input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <Button
            onClick={() => document.getElementById("file-upload")?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload File
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 flex-1">
                <FileIcon className="h-8 w-8 text-blue-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.fileSize)} • {file.uploader.firstName} {file.uploader.lastName} • {new Date(file.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = file.filePath;
                    link.download = file.fileName;
                    link.target = "_blank";
                    link.click();
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(file.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No files uploaded yet. Upload your first file!
            </div>
          )}

          {hasMore ? (
            <div className="pt-2 flex justify-center">
              <Button
                variant="outline"
                disabled={isLoadingMore}
                onClick={async () => {
                  setIsLoadingMore(true);
                  try {
                    setPage((prev) => prev + 1);
                  } finally {
                    setIsLoadingMore(false);
                  }
                }}
              >
                {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Carica altri ({total - files.length})
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
