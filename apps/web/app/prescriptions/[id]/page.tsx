import { fetchPrescription } from "../../../src/lib/api";

export default async function PrescriptionViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prescription = await fetchPrescription(id);

  if (!prescription) {
    return <p className="empty-state">Prescription not found.</p>;
  }

  return (
    <section className="detail-card">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Prescription viewer</p>
          <h2>{prescription.medication_name}</h2>
        </div>
        <span className="badge">ID {prescription.id}</span>
      </div>

      <div className="detail-grid">
        <article>
          <span>Dosage</span>
          <strong>{prescription.dosage}</strong>
        </article>
        <article>
          <span>Schedule</span>
          <strong>{prescription.frequency}</strong>
        </article>
        <article>
          <span>Instructions</span>
          <p>{prescription.instructions}</p>
        </article>
        <article>
          <span>Next dose</span>
          <strong>20:00</strong>
        </article>
      </div>
    </section>
  );
}
