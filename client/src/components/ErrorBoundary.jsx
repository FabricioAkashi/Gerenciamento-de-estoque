import React, { Component } from 'react';

export class ErrorBoundary extends Component {
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
        <main className="fatal-error">
          <h1>O painel nao conseguiu abrir</h1>
          <p>{this.state.error.message}</p>
          <span>Abra o terminal ou o console do navegador para ver o detalhe do erro.</span>
        </main>
      );
    }

    return this.props.children;
  }
}
