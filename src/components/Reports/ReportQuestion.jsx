import PropTypes from "prop-types";
import { Input, Checkbox } from "antd";
import "./ReportQuestion.css";

const { TextArea } = Input;

export default function ReportQuestion({
  question,
  multipleReports,
  reportId,
  setReportData,
  handleUpdateReport,
  disabled,
}) {
  const handleAnswerChange = (e) => {
    const updatedReport = { ...question };

    if (question.type === "text") {
      updatedReport.answer_text = e.target.value;
    } else if (question.type === "boolean") {
      updatedReport.answer_boolean = e.target.checked;
    }

    setReportData((prevContent) => {
      const updatedCurrentContent = prevContent.content.map((item) => {
        if (multipleReports && item.id === reportId) {
          const updatedContent = item.content.map((q) =>
            q.id === question.id ? updatedReport : q
          );
          return { ...item, content: updatedContent };
        } else if (item.id === question.id) {
          return updatedReport;
        } else {
          return item;
        }
      });
      return { ...prevContent, content: updatedCurrentContent };
    });

    handleUpdateReport({
      updatedReport: updatedReport,
      updateMultipleReports: false,
      reportId: reportId,
    });
  };

  return (
    <main className="question">
      {question.type == "text" ? (
        <>
          <h5 className="question--title">{question.title}</h5>
          <TextArea
            value={question.answer_text}
            onChange={handleAnswerChange}
            placeholder="Enter your response here"
            disabled={disabled}
            rows={3}
          />
        </>
      ) : (
        <Checkbox
          checked={question.answer_boolean}
          onChange={handleAnswerChange}
          disabled={disabled}
        >
          <h5 className="question--title">{question.title}</h5>
        </Checkbox>
      )}
    </main>
  );
}

ReportQuestion.propTypes = {
  question: PropTypes.object,
  multipleReports: PropTypes.bool,
  reportId: PropTypes.number,
  setReportData: PropTypes.func,
  handleUpdateReport: PropTypes.func,
  disabled: PropTypes.bool,
};
