import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export interface FileUpload {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  createdAt: string;
  uploader: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface FilesResponse {
  files: FileUpload[];
  total: number;
}

interface UploadFileData {
  file: File;
  projectId: string;
}

interface UploadFileResponse {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  projectId: string;
  uploadedBy: string;
  createdAt: string;
}

/**
 * Hook per ottenere i file di un progetto con paginazione
 */
export function useProjectFiles(projectId: string, page: number, pageSize: number) {
  return useQuery<FilesResponse>({
    queryKey: ['project-files', projectId, page, pageSize],
    queryFn: async () => {
      const res = await fetch(
        `/api/files?projectId=${projectId}&page=${page}&pageSize=${pageSize}`
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch files');
      }
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 1 * 60 * 1000, // 1 minuto
  });
}

/**
 * Hook per caricare un file con invalidazione della cache
 */
export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation<UploadFileResponse, Error, UploadFileData>({
    mutationFn: async ({ file, projectId }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);

      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
        // Non impostare Content-Type, FormData lo imposta automaticamente con boundary
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      return res.json();
    },

    onSuccess: () => {
      toast.success('File caricato con successo');
    },

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Errore durante il caricamento');
    },

    onSettled: (_data, _error, variables) => {
      // Invalida tutte le query dei file del progetto
      queryClient.invalidateQueries({
        queryKey: ['project-files', variables.projectId],
      });
    },
  });
}

/**
 * Hook per eliminare un file con optimistic update
 */
export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { fileId: string; projectId: string }>({
    mutationFn: async ({ fileId }) => {
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete file');
      }
    },

    // OPTIMISTIC UPDATE - Rimuove il file immediatamente dalla UI
    onMutate: async ({ fileId, projectId }) => {
      // Cancella le refetch in corso
      await queryClient.cancelQueries({
        queryKey: ['project-files', projectId],
      });

      // Snapshot dei dati precedenti
      const previousQueries = queryClient.getQueriesData<FilesResponse>({
        queryKey: ['project-files', projectId],
      });

      // Aggiorna ottimisticamente rimuovendo il file
      queryClient.setQueriesData<FilesResponse>(
        { queryKey: ['project-files', projectId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            files: old.files.filter((f) => f.id !== fileId),
            total: old.total - 1,
          };
        }
      );

      return { previousQueries };
    },

    onError: (err, variables, context) => {
      // Rollback in caso di errore
      const ctx = context as { previousQueries?: [readonly unknown[], FilesResponse | undefined][] } | undefined;
      if (ctx?.previousQueries) {
        ctx.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey as readonly unknown[], data);
        });
      }
      toast.error(err instanceof Error ? err.message : 'Errore durante l\'eliminazione');
    },

    onSuccess: () => {
      toast.success('File eliminato con successo');
    },

    onSettled: (_data, _error, variables) => {
      // Refetch per assicurare dati aggiornati
      queryClient.invalidateQueries({
        queryKey: ['project-files', variables.projectId],
      });
    },
  });
}
