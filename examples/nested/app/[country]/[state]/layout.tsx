export default function Layout({ children, params }) {
  console.log("app/[country]/[state]/layout.tsx", params);
  return <div>{children}</div>;
}
