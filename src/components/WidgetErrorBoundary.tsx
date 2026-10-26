import React from 'react';

export class WidgetErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="notch-empty" role="alert">
      <h2>This widget could not open</h2>
      <p>Your saved data is still on this computer. You can retry or choose another tab.</p>
      <button type="button" className="notch-button" onClick={() => this.setState({ failed: false })}>Retry widget</button>
    </div>;
  }
}
