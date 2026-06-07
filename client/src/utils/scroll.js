export function scrollToBookingForm() {
  requestAnimationFrame(() => {
    document.getElementById("booking-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}
