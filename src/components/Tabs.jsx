import PropTypes from "prop-types";
import { Tabs, ConfigProvider } from "antd";

export default function TabsComponent({ defaultActiveKey, items, onChange }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#0A5E84",
        },
      }}
    >
      <Tabs
        defaultActiveKey={defaultActiveKey}
        items={items}
        onChange={onChange}
      />
    </ConfigProvider>
  );
}

TabsComponent.propTypes = {
  defaultActiveKey: PropTypes.string,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string,
    })
  ),
  onChange: PropTypes.func,
};
