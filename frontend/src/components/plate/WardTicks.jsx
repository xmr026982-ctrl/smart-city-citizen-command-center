function WardTicks() {
  return (
    <div className="ward-ticks">
      {Array.from({ length: 8 }).map((_, i) => <i key={i} />)}
    </div>
  );
}

export default WardTicks;