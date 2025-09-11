import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { message, Switch } from "antd";
import Tabs from "../Tabs.jsx";
import ReportsTable from "./ReportsTable";
import ReportModal from "./ReportModal";
import useGetReports from "../../hooks/useGetReports.js";
import useGetReport from "../../hooks/useGetReport";
import useGetInvoiceReport from "../../hooks/useGetInvoiceReport.js";
import useCreateReportPDF from "../../hooks/useCreateReportPDF";
import { UserContext } from "../../UserContext";
import "./index.css";

const getEndOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  const daysToSaturday = 6 - day;
  d.setDate(d.getDate() + daysToSaturday);
  d.setHours(23, 59, 59, 999); // normalize to end of day
  return d;
};

export default function Reports() {
  const { user } = useContext(UserContext);
  const { role } = user;
  const { reportId, reportInvoiceId, reportStudentId } = useParams();
  const navigate = useNavigate();

  const [reportView, setReportView] = useState(
    role === "tutor" ? "unsubmitted" : "submitted"
  );
  const [filteredReports, setFilteredReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState({
    id: null,
    invoice_id: null,
    student_id: null,
  });
  const [upcomingReportsVisible, setUpcomingReportsVisible] = useState(
    localStorage.getItem("educatch_upcomingReportsVisible") === "true"
  );
  const [weeklyReportsView, setWeeklyReportsView] = useState(
    localStorage.getItem("educatch_weeklyReportsView") === "true"
  );

  const {
    data: reportsData,
    isLoading: reportsDataLoading,
    isError: reportsDataError,
  } = useGetReports();

  const {
    data: reportData,
    isError: reportDataError,
    isFetching: reportDataFetching,
  } = useGetReport(selectedReport?.id);

  const {
    data: weeklyReportData,
    isError: weeklyReportDataError,
    isFetching: weeklyReportDataFetching,
  } = useGetInvoiceReport(
    selectedReport?.invoice_id,
    selectedReport?.student_id
  );

  const createReportPDF = useCreateReportPDF();

  const handleOpenReport = ({
    reportId = null,
    reportInvoiceId = null,
    reportStudentId = null,
  }) => {
    if (weeklyReportsView)
      navigate(
        `/reports/invoice/${reportInvoiceId}/student/${reportStudentId}`
      );
    else navigate(`/reports/${reportId}`);
  };

  const handleCloseReport = () => {
    navigate("/reports");
  };

  const handleCreateReportPDF = (reportData) => {
    createReportPDF.mutate({
      invoice_id: reportData.invoice_id,
      student_id: reportData.student_id,
      week_short: reportData.week_short,
      student_name: reportData.student_name,
    });
  };

  const reportTabs =
    role === "admin"
      ? [
          { key: "submitted", label: "Submitted" },
          { key: "overdue", label: "Overdue" },
          { key: "safeguarding", label: "Safeguarding Concerns" },
          { key: "unsubmitted", label: "Unsubmitted" },
        ]
      : [
          { key: "unsubmitted", label: "Unsubmitted" },
          { key: "submitted", label: "Submitted" },
        ];

  useEffect(() => {
    if (reportsData) {
      let newFilteredReports;

      newFilteredReports = weeklyReportsView
        ? reportsData["weekly"]
        : reportsData["lesson-based"];
      newFilteredReports = newFilteredReports.filter((report) => {
        const isUpcoming = new Date(report.start_time) > new Date();

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const baseDate = weeklyReportsView ? report.week : report.end_time;
        const endOfReportWeek = getEndOfWeek(baseDate);
        const isOverdue = endOfReportWeek < oneWeekAgo; // lessons where end of report week is over a week ago

        switch (reportView) {
          case "unsubmitted":
            return (
              (report.status === "empty" || report.status === "incomplete") &&
              (upcomingReportsVisible || !isUpcoming)
            );
          case "submitted":
            return (
              report.status === "submitted" &&
              (upcomingReportsVisible || !isUpcoming)
            );
          case "overdue":
            return (
              (report.status === "empty" || report.status === "incomplete") &&
              isOverdue
            );
          case "safeguarding":
            return report.safeguarding_concern;

          default:
            return false;
        }
      });
      setFilteredReports(newFilteredReports);
      if (reportId || (reportInvoiceId && reportStudentId)) {
        let currentReport;
        if (reportId) {
          currentReport = reportsData["lesson-based"].find(
            (report) => report.id === parseInt(reportId)
          );
        } else {
          currentReport = reportsData["weekly"].find(
            (report) =>
              report.invoice_id === parseInt(reportInvoiceId) &&
              report.student_id === parseInt(reportStudentId)
          );
        }
        if (currentReport) {
          setSelectedReport(currentReport);
        } else {
          setSelectedReport({
            id: null,
            invoice_id: null,
            student_id: null,
          });
          navigate("/reports");
          message.error("Error loading report. Please try again later.");
        }
      } else {
        setSelectedReport({
          id: null,
          invoice_id: null,
          student_id: null,
        });
      }
    }
  }, [
    reportsData,
    reportView,
    reportId,
    reportInvoiceId,
    reportStudentId,
    upcomingReportsVisible,
    navigate,
    weeklyReportsView,
  ]);

  return (
    <>
      <header className="reports--header">
        <div className="reports--title">
          <h3>{role === "admin" ? "Reports" : "Your reports"}</h3>
          <Switch
            checkedChildren="Per week"
            unCheckedChildren="Per lesson"
            value={weeklyReportsView}
            onChange={() => {
              setWeeklyReportsView((prevData) => {
                const newVal = !prevData;
                localStorage.setItem("educatch_weeklyReportsView", newVal);
                return newVal;
              });
            }}
          />
        </div>
        {role === "tutor" && (
          <div className="reports--switch">
            <span>Show upcoming</span>
            <Switch
              checked={upcomingReportsVisible}
              onClick={() =>
                setUpcomingReportsVisible((prevData) => {
                  localStorage.setItem(
                    "educatch_upcomingReportsVisible",
                    !prevData
                  );
                  return !prevData;
                })
              }
            />
          </div>
        )}
      </header>

      <Tabs items={reportTabs} onChange={(key) => setReportView(key)} />

      <main className="reports--report-view">
        <ReportsTable
          key={[reportView, weeklyReportsView]}
          reportView={reportView}
          role={role}
          data={filteredReports}
          handleOpenReport={handleOpenReport}
          handleCreateReportPDF={handleCreateReportPDF}
          isError={reportsDataError}
          isLoading={reportsDataLoading}
          weeklyReportsView={weeklyReportsView}
        />
      </main>

      <ReportModal
        open={
          selectedReport?.id !== null ||
          (selectedReport?.invoice_id !== null &&
            selectedReport?.student_id !== null)
        }
        onClose={handleCloseReport}
        data={{
          ...selectedReport,
          id: weeklyReportsView ? weeklyReportData?.id : selectedReport.id,
          multiple_reports: weeklyReportsView,
          title: weeklyReportsView ? "Weekly Report" : selectedReport.title,
          content: weeklyReportsView ? weeklyReportData?.content : reportData,
        }}
        role={role}
        isFetching={
          weeklyReportsView ? weeklyReportDataFetching : reportDataFetching
        }
        isError={weeklyReportsView ? weeklyReportDataError : reportDataError}
        handleCreateReportPDF={handleCreateReportPDF}
        studentId={selectedReport?.student_id}
      />
    </>
  );
}
