export default function Container({ children, className = "", as: Tag = "div" }) {
  return <Tag className={`mx-auto w-full max-w-[1240px] px-5 sm:px-8 ${className}`.trim()}>{children}</Tag>;
}
