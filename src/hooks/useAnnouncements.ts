import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  clearAnnouncementImage,
  createAnnouncement,
  deleteAnnouncement,
  listAllAnnouncements,
  listPublishedAnnouncements,
  replaceAnnouncementImage,
  setAnnouncementPublished,
  updateAnnouncement,
  type Announcement,
  type AnnouncementInput,
} from "@/services/announcements";

export function usePublishedAnnouncements() {
  return useQuery({
    queryKey: QUERY_KEYS.announcements,
    queryFn: listPublishedAnnouncements,
  });
}

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: QUERY_KEYS.adminAnnouncements,
    queryFn: listAllAnnouncements,
  });
}

function useInvalidateAnnouncements() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAnnouncements });
  };
}

export function useCreateAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (input: AnnouncementInput) => createAnnouncement(input),
    onSuccess: invalidate,
  });
}

export function useUpdateAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AnnouncementInput }) => updateAnnouncement(id, input),
    onSuccess: invalidate,
  });
}

export function useSetAnnouncementPublished() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) => setAnnouncementPublished(id, published),
    onSuccess: invalidate,
  });
}

export function useDeleteAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (row: Announcement) => deleteAnnouncement(row),
    onSuccess: invalidate,
  });
}

export function useReplaceAnnouncementImage() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: ({ row, file, focalX, focalY }: { row: Announcement; file: File; focalX: number; focalY: number }) =>
      replaceAnnouncementImage(row, file, focalX, focalY),
    onSuccess: invalidate,
  });
}

export function useClearAnnouncementImage() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (row: Announcement) => clearAnnouncementImage(row),
    onSuccess: invalidate,
  });
}
