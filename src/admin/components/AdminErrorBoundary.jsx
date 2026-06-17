import { Component } from "react";

/** Catches render errors so one bad row does not white-screen the admin app. */
export class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[admin]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="sa-card" style={{ margin: 24, padding: 24 }}>
          <h2 className="sa-fw-600" style={{ marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p className="sa-text-muted sa-text-sm" style={{ marginBottom: 16, lineHeight: 1.5 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            className="sa-btn sa-btn-primary"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
