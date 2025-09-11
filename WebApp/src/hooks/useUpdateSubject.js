import { useMutation, useQueryClient } from "react-query";
import api from "./api";

const updateTutor = async ({ id: subjectId, data }) => {
  const response = await api.put(`/subjects/${subjectId}`, data);
  return response.data;
};

const useUpdateSubject = () => {
  const queryClient = useQueryClient();

  return useMutation(updateTutor, {
    onSuccess: () => queryClient.invalidateQueries("subjects"),
  });
};

export default useUpdateSubject;
