import { useQuery } from "react-query";
import api from "./api";

const useGetInvoiceReport = (invoiceId, studentId) => {
  const getInvoiceStudentReport = async () => {
    const response = await api.get(
      `/invoices/${invoiceId}/student/${studentId}/report`
    );

    return response.data;
  };

  return useQuery(
    ["invoice--student-report", invoiceId, studentId],
    getInvoiceStudentReport,
    {
      enabled: invoiceId !== null && studentId !== null,
      refetchOnWindowFocus: false,
      staleTime: 0,
    }
  );
};

export default useGetInvoiceReport;
