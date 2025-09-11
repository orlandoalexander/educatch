import { useState } from "react";
import PropTypes from "prop-types";
import { Table, Badge, Space, Button } from "antd";
import useUpdateReport from "../../hooks/useUpdateReport";
import "./ReportsTable.css";

export default function ReportsTable({
  reportView,
  data,
  role,
  isError,
  isLoading,
  handleOpenReport,
  handleCreateReportPDF,
  weeklyReportsView,
}) {
  const [selectedReports, setSelectedReports] = useState([]);
  const updateReportMutation = useUpdateReport();

  const handleUpdateReportStatus = ({
    reportData = null,
    multipleReportsStatus = null,
    multipleReportIds = null,
  }) => {
    updateReportMutation.mutate({
      reportId: reportData?.id,
      invoiceId: reportData?.invoice_id,
      loadingMessage: multipleReportsStatus
        ? `${
            multipleReportsStatus === "submitted"
              ? "Submitting"
              : "Unsubmitting"
          } ${multipleReportIds?.length || selectedReports.length} report${
            multipleReportIds?.length > 1 || selectedReports.length > 1
              ? "s"
              : ""
          }...`
        : `${
            reportData?.status === "submitted" ? "Unsubmitting" : "Submitting"
          } report...`,
      successMessage: multipleReportsStatus
        ? `${
            multipleReportsStatus === "submitted" ? "Submitted" : "Unsubmitted"
          } ${multipleReportIds?.length || selectedReports.length} report${
            multipleReportIds?.length > 1 || selectedReports.length > 1
              ? "s"
              : ""
          }`
        : `Report ${
            reportData?.status === "submitted" ||
            multipleReportsStatus === "submitted"
              ? "un"
              : ""
          }submitted`,
      data: {
        status: multipleReportsStatus
          ? multipleReportsStatus
          : reportData.status === "submitted"
          ? "incomplete"
          : "submitted",
        report_ids: multipleReportIds || selectedReports,
      },
    });
    setSelectedReports([]);
  };

  const getBadgeStatus = (status) => {
    switch (status) {
      case "submitted":
        return "success";
      case "incomplete":
        return "processing";
      case "empty":
        return "error";
      default:
        return "default";
    }
  };

  const statusFilters = [...new Set(data.map((item) => item.status))].map(
    (status) => {
      const item = data.find((d) => d.status === status);
      return {
        text: item.status_text,
        value: status,
      };
    }
  );

  const tutorFilters = [...new Set(data.map((item) => item.tutor_name))].map(
    (tutor_name) => {
      const item = data.find((d) => d.tutor_name === tutor_name);
      return {
        text: item.tutor_name,
        value: tutor_name,
      };
    }
  );

  const studentFilters = [
    ...new Set(data.map((item) => item.student_name)),
  ].map((student_name) => {
    const item = data.find((d) => d.student_name === student_name);
    return {
      text: item.student_name,
      value: student_name,
    };
  });

  const weekFilters = [...new Set(data.map((item) => item.week))].map(
    (week) => {
      const item = data.find((d) => d.week === week);
      return {
        text: item.week_short,
        value: week,
      };
    }
  );

  const invoiceFilters = [
    ...new Set(data.map((item) => item.invoice_title)),
  ].map((invoice_title) => ({
    text: invoice_title,
    value: invoice_title,
  }));

  const getColumns = () => {
    let columns = [
      {
        title: "Report",
        dataIndex: "id_ext",
        sorter: (a, b) => a.id_ext.localeCompare(b.id_ext),
      },
      {
        title: "Lesson Date & Time",
        dataIndex: "lesson_time_short",
        sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time),
      },
      {
        title: "Student",
        dataIndex: "student_name",
        filters: studentFilters,
        onFilter: (value, record) => record.student_name === value,
      },
      {
        title: "Invoice",
        dataIndex: "invoice_title",
        filters: invoiceFilters,
        onFilter: (value, record) => record.invoice_title === value,
        sorter: (a, b) => a.invoice_title.localeCompare(b.invoice_title),
      },
      {
        title: "Week",
        dataIndex: "week_short",
        filters: weekFilters,
        onFilter: (value, record) => record.week === value,
        sorter: (a, b) => new Date(a.week) - new Date(b.week),
      },
      {
        title: "Status",
        dataIndex: "status_text",
        width: 150,
        render: (status_text, record) => (
          <Badge status={getBadgeStatus(record.status)} text={status_text} />
        ),
        filters: statusFilters,
        onFilter: (value, record) => record.status === value,
      },

      {
        title: "",
        key: "action",
        align: "right",
        fix: "right",
        render: (report) => (
          <Space size="middle">
            <a
              onClick={() =>
                handleOpenReport({
                  reportId: report.id,
                  reportInvoiceId: report.invoice_id,
                  reportStudentId: report.student_id,
                })
              }
            >
              View/Edit
            </a>

            <a
              style={{
                pointerEvents: selectedReports.length > 0 ? "none" : "auto",
                color: selectedReports.length > 0 ? "gray" : "",
              }}
              onClick={() => {
                if (weeklyReportsView)
                  handleUpdateReportStatus({
                    reportData: report,
                    multipleReportsStatus:
                      report.status === "submitted"
                        ? "incomplete"
                        : "submitted",
                    multipleReportIds: report.report_ids,
                  });
                else handleUpdateReportStatus({ reportData: report });
              }}
            >
              {report.status === "submitted" ? "Unsubmit" : "Submit"}
            </a>

            {weeklyReportsView && (
              <a onClick={() => handleCreateReportPDF(report)}>Download</a>
            )}
          </Space>
        ),
      },
    ];

    if (weeklyReportsView) {
      columns = [columns[4], ...columns.slice(2, 4), ...columns.slice(5)];

      const totalLessonsColumn = {
        title: "Reports",
        dataIndex: "report_ids",
        render: (report_ids) => report_ids?.length,
        sorter: (a, b) => a.report_ids.length - b.report_ids.length,
      };

      columns.splice(columns.length - 2, 0, totalLessonsColumn); // insert at second last
    }

    if (role === "admin") {
      const updatedColumns = [...columns];
      updatedColumns.splice(2, 0, {
        title: "Tutor",
        dataIndex: "tutor_name",
        filters: tutorFilters,
        onFilter: (value, record) => record.tutor_name === value,
      });
      return updatedColumns;
    }

    return columns;
  };

  if (isError) {
    return (
      <div className="reports--error">
        Error loading reports. Please try again later.
      </div>
    );
  }

  return (
    <div>
      <Table
        columns={getColumns()}
        dataSource={data}
        pagination={true}
        loading={isLoading}
        rowClassName={(record) =>
          record.safeguarding_concern ? "safeguarding-row" : ""
        }
        rowSelection={
          reportView !== "safeguarding"
            ? {
                onChange: (selectedRowKeys, selectedRows) => {
                  if (weeklyReportsView) {
                    const allReportIds = selectedRows.flatMap(
                      (row) => row.report_ids
                    );
                    setSelectedReports(allReportIds);
                  } else setSelectedReports(selectedRowKeys);
                },
              }
            : undefined
        }
      />
      {selectedReports.length > 0 && (
        <>
          {reportView === "submitted" && (
            <Button
              className="table--add-button"
              type="primary"
              onClick={() =>
                handleUpdateReportStatus({
                  multipleReportsStatus: "incomplete",
                })
              }
            >
              {role === "tutor"
                ? `Unsubmit ${selectedReports.length} selected report${
                    selectedReports.length > 1 ? "s" : ""
                  }`
                : `Mark ${selectedReports.length} selected report${
                    selectedReports.length > 1 ? "s" : ""
                  } as unsubmitted`}
            </Button>
          )}
          {(reportView === "overdue" || reportView === "unsubmitted") && (
            <Button
              className="table--add-button"
              type="primary"
              onClick={() =>
                handleUpdateReportStatus({
                  multipleReportsStatus: "submitted",
                })
              }
            >
              {role === "tutor"
                ? `Submit ${selectedReports.length} selected report${
                    selectedReports.length > 1 ? "s" : ""
                  }`
                : `Mark ${selectedReports.length} selected report${
                    selectedReports.length > 1 ? "s" : ""
                  } as submitted`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

ReportsTable.propTypes = {
  reportView: PropTypes.string,
  role: PropTypes.string,
  isError: PropTypes.bool,
  isLoading: PropTypes.bool,
  data: PropTypes.arrayOf(PropTypes.object),
  handleOpenReport: PropTypes.func,
  handleCreateReportPDF: PropTypes.func,
  weeklyReportsView: PropTypes.bool,
};
