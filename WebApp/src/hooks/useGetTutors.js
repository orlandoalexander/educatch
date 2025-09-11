import { useQuery } from "react-query";
import api from "./api";

const useGetTutors = () => {
  const getTutors = async () => {
    const response = await api.get(`/tutors`);
    return response.data;
  };

  return useQuery("tutors", getTutors);
};

export default useGetTutors;
