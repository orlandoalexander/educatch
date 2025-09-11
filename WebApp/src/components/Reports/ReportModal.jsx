import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { Modal, Skeleton, Button, Collapse, Tooltip, Divider } from "antd";
import { User, Calendar, X, Edit3, Check, AlertOctagon } from "react-feather";
import { debounce } from "lodash";
import ReportQuestion from "./ReportQuestion";
import useUpdateReport from "../../hooks/useUpdateReport";
import "./ReportModal.css";

export default function ReportModal({
  open,
  onClose,
  lessonOccurrenceId,
  role,
  studentId,
  data,
  isFetching,
  isError,
  handleCreateReportPDF,
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const disableUnsubmit = searchParams.get("disable_unsubmit");
  const [reportData, setReportData] = useState({
    id: null,
    status: null,
    content: [],
  });

  const updateReportMutation = useUpdateReport();

  const debouncedUpdateReport = useRef(
    debounce((data) => {
      updateReportMutation.mutate(data);
    }, data?.delay || 500)
  ).current;

  const handleUpdateReport = ({
    updatedReport,
    reportStatus,
    delay,
    updateMultipleReports,
    reportId,
    loadingMessage,
    successMessage,
  }) => {
    if (updateMultipleReports) {
      updatedReport.map((report, index) => {
        updateReportMutation.mutate({
          reportId: report.id,
          invoiceId: data.invoice_id,
          studentId: studentId,
          loadingMessage: index == 0 ? loadingMessage : "",
          successMessage: index == 0 ? successMessage : "", // only show success message for first report
          updateStatus: reportStatus ? true : false,
          data: {
            status: reportStatus || report.status,
          },
        });
      });
    } else
      debouncedUpdateReport({
        delay: delay,
        reportId: reportId, // reportId passed when updating individual report from modal showing multiple reports, otherwise use data.id for report id
        invoiceId: data.invoice_id,
        lessonOccurrenceId: lessonOccurrenceId, // lessonOccurrenceId passed so can invalidate report data query when changes made to report from calendar
        studentId: studentId, // studentId passed so can invalidate report data query when changes made to report from invoice drawer
        loadingMessage: loadingMessage,
        successMessage: successMessage,
        updateStatus: reportStatus ? true : false,
        data: {
          status: reportStatus || data.status,
          content: updatedReport,
        },
      });
  };

  const handleSaveDraft = () => {
    handleUpdateReport({
      updatedReport: reportData.content,
      reportStatus: "incomplete",
      reportId: data.id,
      delay: 0,
      updateMultipleReports: data?.multiple_reports,
    });
    onClose();
  };

  const handleSubmit = () => {
    handleUpdateReport({
      updatedReport: reportData.content,
      reportStatus: "submitted",
      reportId: data.id,
      delay: 0,
      updateMultipleReports: data?.multiple_reports,
      loadingMessage: `Submitting report${
        data?.multiple_reports ? "s" : ""
      }...`,
      successMessage: `Report${data?.multiple_reports ? "s" : ""} submitted`,
    });
    onClose();
  };

  const handleUnsubmit = () => {
    handleUpdateReport({
      updatedReport: reportData.content,
      reportStatus: "incomplete",
      reportId: data.id,
      delay: 0,
      updateMultipleReports: data?.multiple_reports,
      loadingMessage: `Unsubmitting report${
        data?.multiple_reports ? "s" : ""
      }...`,
      successMessage: `Report${data?.multiple_reports ? "s" : ""} unsubmitted`,
    });
  };

  useEffect(() => {
    if (
      data?.content &&
      !isFetching &&
      (reportData.id === undefined ||
        reportData.id !== data?.id ||
        reportData.status !== data?.status) // only update reportData if status or id has changed
    ) {
      setReportData({
        id: data.id,
        status: data.status,
        content: data.content,
      });
    }
  }, [data, isFetching, reportData]);

  return (
    <Modal
      zIndex={10000}
      width={830}
      centered
      open={open}
      onCancel={onClose}
      closable={false}
      maskClosable={
        JSON.stringify(reportData.content) === JSON.stringify(data?.content) ||
        !data
      }
      footer={(() => {
        const commonButtons = [];

        if (data?.multiple_reports) {
          commonButtons.push(
            <Button
              key="download"
              disabled={isFetching || isError}
              onClick={() => handleCreateReportPDF(data)}
            >
              Download weekly report
            </Button>
          );
        } else
          commonButtons.push(
            <Button
              key="lesson"
              disabled={isFetching || isError}
              onClick={() =>
                navigate(`/timetable/${data.lesson_occurrence_id.toString()}`)
              }
            >
              Open lesson
            </Button>
          );

        if (reportData?.status === "submitted" && role === "tutor") {
          return [
            ...commonButtons,
            <Tooltip
              key="unsubmit"
              placement="topRight"
              title={
                disableUnsubmit === "true"
                  ? `Cannot unsubmit report${
                      data?.multiple_reports ? "s" : ""
                    } as invoice is already submitted/paid.`
                  : ""
              }
            >
              <Button
                disabled={isFetching || isError || disableUnsubmit === "true"}
                onClick={handleUnsubmit}
                type="primary"
              >
                {`Unsubmit ${
                  data?.multiple_reports ? "all reports" : "report"
                }`}
              </Button>
            </Tooltip>,
          ];
        } else if (reportData?.status === "submitted" && role === "admin") {
          return [
            ...commonButtons,
            <Button
              key="save"
              disabled={
                isFetching ||
                isError ||
                JSON.stringify(reportData.content) ===
                  JSON.stringify(data?.content)
              }
              onClick={onClose}
            >
              Save changes
            </Button>,
            <Tooltip
              key="unsubmit"
              placement="topRight"
              title={
                disableUnsubmit === "true"
                  ? `Cannot unsubmit report${
                      data?.multiple_reports ? "s" : ""
                    } as invoice is already paid/submitted.`
                  : ""
              }
            >
              <Button
                key="unsubmit"
                disabled={isFetching || isError || disableUnsubmit === "true"}
                onClick={handleUnsubmit}
                type="primary"
              >
                {`Unsubmit ${
                  data?.multiple_reports ? "all reports" : "report"
                }`}
              </Button>
            </Tooltip>,
          ];
        } else {
          return [
            ...commonButtons,
            <Button
              key="save"
              disabled={
                isFetching ||
                isError ||
                JSON.stringify(reportData.content) ===
                  JSON.stringify(data?.content)
              }
              onClick={handleSaveDraft}
            >
              Save changes
            </Button>,
            <Button
              key="submit"
              disabled={isFetching || isError}
              onClick={handleSubmit}
              type="primary"
            >
              {`Submit ${data?.multiple_reports ? "all reports" : "report"}`}
            </Button>,
          ];
        }
      })()}
    >
      <main className="report">
        <section className="report--heading">
          <div className="report--title">
            <h3>{data?.title || "Loading..."}</h3>
          </div>

          {!isFetching && data ? (
            <section className="report--details-container">
              <div className="report--details">
                <div>
                  <div className="report--details-icon icon">
                    <User size={14} />
                  </div>
                  <span className="report--details-text">
                    {`${data?.tutor_name} with ${data?.student_name}`}
                  </span>
                </div>
                <div>
                  <div className="report--details-icon icon">
                    <Calendar size={14} />
                  </div>
                  <div className="collapse--title">
                    <span>
                      {data.lesson_time_short || data.week_short}
                      {data.attendance_status_complete ? (
                        <>
                          <span> | </span>
                          <em>{data.attendance_status_complete}</em>
                        </>
                      ) : (
                        ""
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="report--details">
                <div>
                  <div className={`report--details-icon ${data?.status}-icon`}>
                    {data?.status === "submitted" ? (
                      <Check size={14} />
                    ) : data?.status === "incomplete" ? (
                      <Edit3 size={14} />
                    ) : (
                      <X size={14} />
                    )}
                  </div>
                  <span>
                    {isFetching || !data ? "Loading..." : data?.status_text}
                  </span>
                </div>
              </div>
              {data?.safeguarding_concern === 1 && (
                <div className="report--details">
                  <div>
                    <div className="report--details-icon orange-icon">
                      <AlertOctagon size={14} color="red" />
                    </div>

                    <span>Safeguarding concern raised</span>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </section>

        <Divider style={{ margin: "20px 0" }} />

        {isFetching || reportData.content.length === 0 ? (
          <section>
            <Skeleton active />
          </section>
        ) : isError ? (
          <section className="report--error">Error loading report.</section>
        ) : data?.multiple_reports ? (
          <section className="report--collapse">
            <Collapse
              defaultActiveKey={0}
              items={reportData.content?.map((report, index) => ({
                key: index,
                label: (
                  <div className="collapse--header">
                    <div className="collapse--title">
                      <span>{`${report.title} | ${report.lesson_time_short}`}</span>
                      <span>
                        {report.attendance_status_complete ? (
                          <em>{report.attendance_status_complete}</em>
                        ) : (
                          ""
                        )}
                      </span>
                    </div>
                    <div className="collapse--info">
                      {report.safeguarding_concern === 1 && (
                        <div className="report--details-icon orange-icon">
                          <AlertOctagon size={14} color="red" />
                        </div>
                      )}
                      <div
                        className={`report--details-icon ${report?.status}-icon`}
                      >
                        {report?.status === "submitted" ? (
                          <Check size={14} />
                        ) : report?.status === "incomplete" ? (
                          <Edit3 size={14} />
                        ) : (
                          <X size={14} />
                        )}
                      </div>
                      <Button
                        size="small"
                        onClick={() => {
                          navigate(
                            `/timetable/${report.lesson_occurrence_id.toString()}`
                          );
                        }}
                      >
                        Open lesson
                      </Button>
                    </div>
                  </div>
                ),
                children: (
                  <section className="report--questions">
                    {report.content
                      ?.slice()
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((question) => (
                        <ReportQuestion
                          key={question.id}
                          multipleReports={true}
                          reportId={report.id}
                          question={question}
                          handleUpdateReport={handleUpdateReport}
                          setReportData={setReportData}
                          disabled={
                            report.status === "submitted" && role !== "admin"
                          }
                        />
                      ))}
                  </section>
                ),
              }))}
            />
          </section>
        ) : (
          <section className="report--questions">
            {reportData.content
              ?.slice()
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((question) => (
                <ReportQuestion
                  key={[question.id, reportData?.status]}
                  multipleReports={false}
                  reportId={data?.id}
                  question={question}
                  handleUpdateReport={handleUpdateReport}
                  setReportData={setReportData}
                  disabled={
                    reportData?.status === "submitted" && role !== "admin"
                  }
                />
              ))}
          </section>
        )}
      </main>
    </Modal>
  );
}

ReportModal.propTypes = {
  onClose: PropTypes.func,
  open: PropTypes.bool,
  lessonOccurrenceId: PropTypes.number,
  role: PropTypes.string,
  studentId: PropTypes.number,
  data: PropTypes.object,
  isFetching: PropTypes.bool,
  isError: PropTypes.bool,
  handleCreateReportPDF: PropTypes.func,
};
