import AuthGuard from '../../components/AuthGuard';

export default function Layout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
