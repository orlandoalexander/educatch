import { useQuery } from "react-query";
import api from "./api";

const useGetReport = (reportId) => {
  const getReport = async () => {
    const response = await api.get(`/reports/${reportId}`);
    return response.data;
  };
  return useQuery(["report", reportId], getReport, {
    enabled: reportId !== null && reportId !== undefined,
    refetchOnWindowFocus: false,
  });
};

export default useGetReport;
