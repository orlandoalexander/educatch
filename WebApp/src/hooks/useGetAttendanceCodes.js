import { useQuery } from "react-query";
import api from "./api";

const useGetAttendanceCodes = () => {
  const getAttendanceCodes = async () => {
    const response = await api.get(`/attendance-codes`);
    return response.data;
  };

  return useQuery("attendance-codes", getAttendanceCodes);
};

export default useGetAttendanceCodes;
