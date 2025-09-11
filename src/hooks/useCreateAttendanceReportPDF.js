import { useMutation } from "react-query";
import api from "./api";
import { message } from "antd";

const useCreateAttendanceReportPDF = () => {
  const createAttendanceReportPDF = async (data) => {
    const hide = message.loading("Downloading attendance report...", 0); // persist until manually closed

    try {
      const response = await api.post(`/attendance-report-pdf`, data, {
        responseType: "blob",
      });

      const disposition = response.headers["content-disposition"];
      let filename = `${data.student_name}'s Attendance Report.pdf`;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="(.+)"/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { message: "Downloaded attendance report successfully", hide };
    } catch (error) {
      hide(); // close the loading message before throwing
      throw error;
    }
  };

  return useMutation(createAttendanceReportPDF, {
    onSuccess: ({ message: successMessage, hide }) => {
      hide(); // close the loading message
      message.success(successMessage);
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message ||
          "Error downloading attendance report. Please try again later."
      );
    },
  });
};

export default useCreateAttendanceReportPDF;
