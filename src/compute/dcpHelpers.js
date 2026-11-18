export const getSliceCount = (task) => {
  if (typeof task === "number") return task;
  if (!task || typeof task !== "object") return null;
  if (Array.isArray(task.slices)) return task.slices.length;
  if (task.slices && typeof task.slices === "object") {
    // slices is grouped by job: { [jobAddress]: [slice, slice, ...] }
    // so count what's inside each group, not the number of groups.
    return Object.values(task.slices).reduce((sum, group) => {
      if (Array.isArray(group)) return sum + group.length;
      if (typeof group === "number") return sum + group;
      if (group && typeof group === "object") {
        const inner = Object.keys(group).length;
        // a single slice object vs. a map of slices
        return sum + (group.sliceNumber !== undefined ? 1 : inner || 1);
      }
      return sum + 1;
    }, 0);
  }
  if (typeof task.sliceCount === "number") return task.sliceCount;
  return null;
};

export const getJobInfo = (task) => {
  const jobs = task && task.jobs;
  let id = null;
  let job = null;

  if (Array.isArray(jobs) && jobs.length) {
    job = jobs[0];
  } else if (jobs && typeof jobs === "object") {
    const keys = Object.keys(jobs);
    if (keys.length) {
      id = keys[0];
      job = jobs[id];
    }
  }

  job = job || {};
  id = id || job.address || job.id || job.jobAddress || task?.jobAddress || null;

  const name =
    job.public?.name || job.name || task?.job?.public?.name || "Unnamed DCP job";
  const description = job.public?.description || job.description || "";

  // Pay offered per slice, if the scheduler includes it
  const rawOffer =
    job.slicePaymentOffer ?? job.paymentOffer ?? job.payment ?? null;
  const offerValue =
    rawOffer && typeof rawOffer === "object"
      ? rawOffer.offerPerSlice ?? rawOffer.value ?? rawOffer.amount ?? null
      : rawOffer;
  const offerNum =
    offerValue === null || offerValue === undefined
      ? null
      : Number(String(offerValue));

  return {
    id: id ? String(id) : "Unknown",
    name,
    description,
    offerPerSlice: Number.isFinite(offerNum) ? offerNum : null,
    jobCount: jobs && typeof jobs === "object" ? Object.keys(jobs).length : 1
  };
};


export const getPaymentAmount = (ev) => {
  const raw =
    ev && typeof ev === "object"
      ? ev.payment ?? ev.amount ?? ev.value ?? ev.earned ?? null
      : ev;
  if (raw === null || raw === undefined) return null;
  const n = Number(String(raw));
  return Number.isFinite(n) ? n : null;
};