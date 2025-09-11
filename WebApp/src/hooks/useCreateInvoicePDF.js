import { useMutation } from "react-query";
import api from "./api";
import { message } from "antd";

const useCreateInvoicePDF = () => {
  const createInvoicePDF = async (data) => {
    const hide = message.loading("Downloading invoice...", 0); // stays until manually closed

    try {
      const response = await api.post(`/invoice-pdf`, data, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${data.invoice_title}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { message: "Downloaded invoice successfully", hide };
    } catch (error) {
      hide(); // close loading on error
      throw error;
    }
  };

  return useMutation(createInvoicePDF, {
    onSuccess: ({ message: successMessage, hide }) => {
      hide(); // close loading on success
      message.success(successMessage);
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message ||
          "Error downloading invoice. Please try again later."
      );
    },
  });
};

export default useCreateInvoicePDF;
