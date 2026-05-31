import React from "react";
import "./ErrorBoundary.css";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary page-aurora">
          <div className="error-boundary-card">
            <h1>Что-то пошло не так</h1>
            <p>Обновите страницу. Если ошибка повторится — напишите в поддержку.</p>
            <pre className="error-boundary-pre">
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              type="button"
              className="error-boundary-btn"
              onClick={() => window.location.reload()}
            >
              Обновить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
