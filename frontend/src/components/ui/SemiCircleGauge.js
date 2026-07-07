import GaugeComponent from 'react-gauge-component';

export default function SemiCircleGauge({ score = 0, size = 200, color = 'var(--accent)' }) {
  const clampedScore = Math.max(0, Math.min(100, score));

  return (
    <div style={{
      width: '100%',
      maxWidth: size,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <GaugeComponent
        type="semicircle"
        arc={{
          width: 0.2,
          padding: 0.005,
          cornerRadius: 1,
          subArch: { startAngle: 0, endAngle: 0 },
          colorArray: ['#EF4444', '#F59E0B', '#10B981'],
          nbSubArches: 2,
        }}
        pointer={{
          color: '#F1F5F9',
          length: 0.80,
          width: 15,
          triangleHeight: 10,
          ellipseRadius: 8,
          elastic: true,
        }}
        value={clampedScore}
        minValue={0}
        maxValue={100}
        labels={{
          valueRender: (value) => `${Math.round(value)}`,
          tickRender: (value) => {
            if (value % 25 === 0) return `${value}`;
            return '';
          },
          valueLabel: {
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-primary, #F1F5F9)',
            fontFamily: 'Inter, sans-serif',
          },
          tickLabels: {
            type: 'outer',
            defaultTickValueConfig: {
              fontSize: 11,
              color: 'var(--text-muted, #64748B)',
              fontFamily: 'Inter, sans-serif',
            },
            defaultTickLineConfig: {
              length: 8,
              width: 2,
              color: 'var(--text-muted, #64748B)',
            },
          },
        }}
        style={{
          width: '100%',
          height: size * 0.65,
        }}
      />
    </div>
  );
}
