type SignatureResponse = {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
};

export async function uploadPhoto(
  file: File,
): Promise<{ url: string; publicId: string }> {
  const sigRes = await fetch("/api/cloudinary-signature", { method: "POST" });
  if (!sigRes.ok) {
    const body = (await sigRes.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(
      `Failed to get upload signature (${sigRes.status}): ${body?.error ?? sigRes.statusText}`,
    );
  }
  const { signature, timestamp, cloudName, apiKey, folder } =
    (await sigRes.json()) as SignatureResponse;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Cloudinary upload failed: ${text}`);
  }

  const data = (await uploadRes.json()) as {
    secure_url: string;
    public_id: string;
  };
  return { url: data.secure_url, publicId: data.public_id };
}
