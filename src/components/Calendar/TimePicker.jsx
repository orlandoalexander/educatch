import PropTypes from "prop-types";
import { TimePicker, ConfigProvider } from "antd";
import dayjs from "dayjs";

export default function TimePickerComponent({
  start_time,
  end_time,
  actual_start_time,
  actual_end_time,
  handleSetActualLessonTime,
  timeZoneAbbreviation,
}) {
  const actual_start_time_short = actual_start_time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const actual_end_time_short = actual_end_time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#FFA500",
        },
      }}
    >
      <TimePicker.RangePicker
        value={[
          dayjs(actual_start_time_short, "HH:mm"),
          dayjs(actual_end_time_short, "HH:mm"),
        ]}
        format="HH:mm"
        minuteStep={15}
        onChange={(lesson_time_range) =>
          handleSetActualLessonTime(
            lesson_time_range ? lesson_time_range[0].toDate() : start_time, // convert dayjs object to Date object
            lesson_time_range ? lesson_time_range[1].toDate() : end_time
          )
        }
        suffixIcon={<span> {timeZoneAbbreviation}</span>}
      />
    </ConfigProvider>
  );
}

TimePickerComponent.propTypes = {
  start_time: PropTypes.instanceOf(Date),
  end_time: PropTypes.instanceOf(Date),
  actual_start_time: PropTypes.instanceOf(Date),
  actual_end_time: PropTypes.instanceOf(Date),
  handleSetActualLessonTime: PropTypes.func,
  timeZoneAbbreviation: PropTypes.string,
};
