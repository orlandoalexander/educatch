import { useQuery } from "react-query";
import api from "./api";

const useGetInvoiceLessons = (invoiceId) => {
  const getInvoiceLessons = async () => {
    if (invoiceId === undefined) return;
    const response = await api.get(`/invoices/${invoiceId}/lessons`);
    return response.data;
  };

  return useQuery(["invoice--lessons", invoiceId], getInvoiceLessons, {
    cacheTime: 0,
  });
};

export default useGetInvoiceLessons;
