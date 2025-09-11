import { useMutation } from "react-query";
import api from "./api";
import { message } from "antd";

const useCreateReportPDF = () => {
  const createReportPDF = async (data) => {
    const hide = message.loading("Downloading report...", 0); // persist until manually closed

    try {
      const response = await api.post(`/report-pdf`, data, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${data.student_name}'s Weekly Report - ${data.week_short}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { message: "Downloaded report successfully", hide };
    } catch (error) {
      hide(); // close the loading message before throwing
      throw error;
    }
  };

  return useMutation(createReportPDF, {
    onSuccess: ({ message: successMessage, hide }) => {
      hide(); // close the loading message
      message.success(successMessage);
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message ||
          "Error downloading report. Please try again later."
      );
    },
  });
};

export default useCreateReportPDF;
