import { Component } from 'react';
import { Button } from '../../shared/components/atoms/Button.jsx';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lỗi không được xử lý trong giao diện LMS.', error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">Đã xảy ra lỗi</h1>
        <p className="text-muted-foreground">
          Trang không thể hiển thị. Hãy tải lại hoặc quay về trang chính.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => this.setState({ error: null })} variant="outline">
            Thử lại
          </Button>
          <Button onClick={() => window.location.assign('/')}>Về trang chính</Button>
        </div>
      </main>
    );
  }
}
