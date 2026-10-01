interface FieldErrorProps {
  message?: string;
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p role="alert" className="text-danger font-medium">
      {message}
    </p>
  );
}
