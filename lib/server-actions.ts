"use server";

import { requirePartner } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import {
  addPurchasePayment,
  addSaleReceipt,
  acquireGoatFromCustomer,
  buyGoat,
  changeStatus,
  deleteTransaction,
  deleteAnimal,
  deleteSaleReceipt,
  logExpense,
  logMedical,
  logMilkRecord,
  logWeight,
  recordBreeding,
  recordLactation,
  upsertVetContact,
  deleteVetContact,
  recordBreedingUltrasound,
  updateBreeding,
  deleteBreeding,
  updateVaccineEvents,
  deleteVaccineEvents,
  recordLivestockSale,
  registerBornGoat,
  updateAnimal,
  updateTransaction,
  undoLivestockSale,
} from "@/lib/actions";
import { revalidatePath } from "next/cache";
import type {
  AnimalBreed,
  AnimalSex,
  AnimalStatus,
  LedgerCategory,
  MedicalEventType,
  MilkMeasurementMethod,
  MilkSession,
  MilkSource,
  MilkUnit,
  VetContactRole,
} from "@/lib/types";
import { drugClassForProduct } from "@/lib/livestock/medical-notes";
import { formatDewormNotes, formatVaccineNotes, type DewormType } from "@/lib/livestock/medical-notes";
import { NEW_VACCINE_VALUE, builtinVaccineByName, parseVaccineIntervalDays } from "@/lib/livestock/vaccine-schedule";
import {
  NEW_EXPENSE_CATEGORY_VALUE,
  assertNewCategoryName,
  isValidExpenseCategory,
} from "@/lib/transactions/expense-categories";
import { uploadAnimalMedia } from "@/lib/media/upload";
import type { TransactionEditVariant } from "@/lib/transactions/mutate";
import {
  parsePositiveAmount,
  parseNonNegativeAmount,
  parseOptionalNonNegativeAmount,
  parsePositiveInteger,
  parseOptionalNonNegativeInteger,
  parseOptionalPaidNowAmount,
  parseOptionalPositiveAmount,
} from "@/lib/form-numbers";

function revalidateTxnPaths() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/animals");
  revalidatePath("/health");
}

async function guardWrite() {
  await requirePartner();
}

async function resolveExpenseCategory(formData: FormData): Promise<string> {
  let category = String(formData.get("category") || "").trim();
  if (category === NEW_EXPENSE_CATEGORY_VALUE) {
    category = assertNewCategoryName(String(formData.get("categoryOther") || ""));
  }
  if (!isValidExpenseCategory(category)) {
    throw new Error("Invalid category");
  }
  return category;
}

export type UltrasoundActionResult = { ok: true } | { ok: false; error: string };

function friendlyMedicalError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not save medical record";
  if (message.toLowerCase().includes("supabase_service_role_key")) {
    return "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel environment variables.";
  }
  return message;
}

function friendlyUltrasoundError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not save ultrasound";
  const lower = message.toLowerCase();
  if (lower.includes("ultrasound_date") || lower.includes("fetus_count")) {
    return "Database is missing ultrasound columns. In Supabase SQL Editor, run migrations 006_breeding_ultrasound_date.sql and 009_breeding_fetus_count.sql (see DEPLOY.md).";
  }
  if (lower.includes("supabase_service_role_key")) {
    return "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel environment variables.";
  }
  if (lower.includes("upload failed") || lower.includes("bucket")) {
    return message;
  }
  if (lower.includes("only image and video uploads are supported")) {
    return "Could not upload that file. Use MP4, WebM, or MOV video.";
  }
  return message;
}

export async function actionLogExpense(formData: FormData) {
  await guardWrite();
  const date = String(formData.get("date") || "").trim();
  const amountRaw = String(formData.get("amount") || "").trim();
  const animalRaw = String(formData.get("animalId") || "").trim();
  const notes = String(formData.get("notes") || "");

  if (!date) throw new Error("Date is required");
  const amount = parsePositiveAmount(amountRaw);
  const category = await resolveExpenseCategory(formData);

  await logExpense({
    date,
    amount,
    category,
    animalId: animalRaw ? Number(animalRaw) : null,
    notes,
  });
  revalidateTxnPaths();
}

export async function actionBuyGoat(formData: FormData) {
  await guardWrite();
  try {
    const priceRaw = String(formData.get("price") || "").trim();
    const paidNowRaw = String(formData.get("paidNow") || "").trim();
    await buyGoat({
      date: String(formData.get("date")),
      price: priceRaw ? parseOptionalPositiveAmount(priceRaw, "Price") : null,
      paidNow: parseOptionalPaidNowAmount(paidNowRaw),
      breed: String(formData.get("breed")) as AnimalBreed,
      sex: String(formData.get("sex")) as AnimalSex,
      description: String(formData.get("description")),
      name: String(formData.get("name") || "") || undefined,
      ownerName: String(formData.get("ownerName")),
      vendorName: String(formData.get("vendorName") || "") || undefined,
    });
    revalidateTxnPaths();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not add goat",
    };
  }
}

export async function actionAcquireFromCustomer(formData: FormData) {
  await guardWrite();
  try {
    const paidNowRaw = String(formData.get("paidNow") || "").trim();
    const animalId = parsePositiveInteger(String(formData.get("animalId")), "Goat");
    await acquireGoatFromCustomer({
      animalId,
      date: String(formData.get("date")),
      price: parsePositiveAmount(String(formData.get("price")), "Price"),
      paidNow: parseOptionalPaidNowAmount(paidNowRaw),
      notes: String(formData.get("notes") || "") || undefined,
    });
    revalidatePath(`/animals/${animalId}`);
    revalidateTxnPaths();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not buy goat from customer",
    };
  }
}

export async function actionRegisterBornGoat(formData: FormData) {
  await guardWrite();
  const damRaw = String(formData.get("damId") || "").trim();
  const sireAnimalRaw = String(formData.get("sireAnimalId") || "").trim();
  const sireNameRaw = String(formData.get("sireName") || "").trim();
  if (!damRaw) throw new Error("Select the dam (mother)");
  const damId = Number(damRaw);
  await registerBornGoat({
    date: String(formData.get("date")),
    breed: String(formData.get("breed")) as AnimalBreed,
    sex: String(formData.get("sex")) as AnimalSex,
    description: String(formData.get("description")),
    name: String(formData.get("name") || "") || undefined,
    ownerName: String(formData.get("ownerName")),
    comment: String(formData.get("comment") || "") || undefined,
    damId,
    sireId: sireAnimalRaw ? Number(sireAnimalRaw) : null,
    sireName: sireNameRaw || null,
  });
  revalidatePath(`/animals/${damId}`);
  revalidateTxnPaths();
}

function vaccineNotesFromForm(formData: FormData): string {
  const selectedName = String(formData.get("vaccineName") || "").trim();
  const diseaseTarget =
    selectedName === NEW_VACCINE_VALUE
      ? String(formData.get("vaccineNameOther") || "").trim()
      : selectedName;
  const intervalRaw = String(formData.get("vaccineIntervalDays") || "").trim();
  const intervalDays =
    !builtinVaccineByName(diseaseTarget) && intervalRaw
      ? parseVaccineIntervalDays(intervalRaw)
      : undefined;
  return formatVaccineNotes({
    diseaseTarget,
    productBrand: String(formData.get("productBrand") || "").trim() || undefined,
    dosage: String(formData.get("dosage") || ""),
    intervalDays,
  });
}

function applySimilarFromForm(formData: FormData): boolean {
  const raw = String(formData.get("applySimilar") || "").trim();
  return raw === "1" || raw.toLowerCase() === "on" || raw.toLowerCase() === "true";
}

export async function actionLogMedical(formData: FormData) {
  await guardWrite();
  try {
    const animalIds = formData
      .getAll("animalId")
      .map((v) => Number(String(v).trim()))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (animalIds.length === 0) throw new Error("Select at least one goat");

    const eventType = String(formData.get("eventType")) as MedicalEventType;
    let notes = String(formData.get("notes") || "").trim();

    if (eventType === "Vaccine") {
      notes = vaccineNotesFromForm(formData);
    } else if (eventType === "Deworming") {
      const dewormType = String(formData.get("dewormType") || "") as DewormType;
      const dewormerName = String(formData.get("dewormerName") || "").trim();
      const customName = String(formData.get("dewormerNameOther") || "").trim();
      const resolvedName = dewormerName === "Other" ? customName : dewormerName;
      notes = formatDewormNotes({
        type: dewormType,
        name: resolvedName,
        dosage: String(formData.get("dosage") || ""),
      });
    }

    const comment =
      eventType === "Vaccine" || eventType === "Deworming"
        ? String(formData.get("comment") || "").trim() || undefined
        : String(formData.get("comment") || "").trim() || undefined;

    const famachaRaw = String(formData.get("famachaScore") || "").trim();
    const bcsRaw = String(formData.get("bodyConditionScore") || "").trim();
    const fecRaw = String(formData.get("fecalEggCount") || "").trim();
    const fecReductionRaw = String(formData.get("fecReductionPct") || "").trim();
    const doseRaw = String(formData.get("doseAmount") || "").trim();
    const dewormerResolved =
      eventType === "Deworming"
        ? String(formData.get("dewormerName") || "").trim() === "Other"
          ? String(formData.get("dewormerNameOther") || "").trim()
          : String(formData.get("dewormerName") || "").trim()
        : "";

    await logMedical({
      animalIds,
      eventType,
      date: String(formData.get("date")),
      notes,
      comment,
      famacha_score:
        eventType === "FAMACHA" && famachaRaw
          ? parsePositiveInteger(famachaRaw, "FAMACHA score")
          : famachaRaw
            ? parsePositiveInteger(famachaRaw, "FAMACHA score")
            : null,
      body_condition_score: bcsRaw ? parsePositiveAmount(bcsRaw, "Body condition score") : null,
      fecal_egg_count: fecRaw ? parsePositiveInteger(fecRaw, "Fecal egg count") : null,
      fec_reduction_pct: fecReductionRaw
        ? parsePositiveAmount(fecReductionRaw, "FEC reduction %")
        : null,
      product_brand: String(formData.get("productBrand") || "").trim() || null,
      active_ingredient: String(formData.get("activeIngredient") || "").trim() || null,
      drug_class:
        dewormerResolved ? drugClassForProduct(dewormerResolved) : String(formData.get("drugClass") || "").trim() || null,
      route: String(formData.get("route") || "").trim() || null,
      dose_amount: doseRaw ? parsePositiveAmount(doseRaw, "Dose amount") : null,
      dose_unit: String(formData.get("doseUnit") || "").trim() || null,
      lot_number: String(formData.get("lotNumber") || "").trim() || null,
      expiration_date: String(formData.get("expirationDate") || "").trim() || null,
      production_stage: String(formData.get("productionStage") || "").trim() || null,
      withdrawal_meat_days: parseOptionalNonNegativeInteger(
        String(formData.get("withdrawalMeatDays") || "").trim(),
        "Meat withdrawal days"
      ),
      withdrawal_milk_days: parseOptionalNonNegativeInteger(
        String(formData.get("withdrawalMilkDays") || "").trim(),
        "Milk withdrawal days"
      ),
    });
    revalidateTxnPaths();
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: friendlyMedicalError(err),
    };
  }
}

export async function actionUpdateVaccine(formData: FormData) {
  await guardWrite();
  try {
    const id = String(formData.get("id") || "").trim();
    if (!id) throw new Error("Vaccination not found");
    const { animalIds } = await updateVaccineEvents({
      id,
      date: String(formData.get("date") || ""),
      notes: vaccineNotesFromForm(formData),
      applySimilar: applySimilarFromForm(formData),
    });
    for (const animalId of animalIds) {
      revalidatePath(`/animals/${animalId}`);
    }
    revalidateTxnPaths();
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: friendlyMedicalError(err),
    };
  }
}

export async function actionDeleteVaccine(formData: FormData) {
  await guardWrite();
  try {
    const id = String(formData.get("id") || "").trim();
    if (!id) throw new Error("Vaccination not found");
    const { animalIds } = await deleteVaccineEvents({
      id,
      applySimilar: applySimilarFromForm(formData),
    });
    for (const animalId of animalIds) {
      revalidatePath(`/animals/${animalId}`);
    }
    revalidateTxnPaths();
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: friendlyMedicalError(err),
    };
  }
}

export async function actionLogWeight(formData: FormData) {
  await guardWrite();
  const weightRaw = String(formData.get("weightKg") || "").trim();
  const weightKg = parsePositiveAmount(weightRaw, "Weight");
  await logWeight({
    animalId: Number(formData.get("animalId")),
    weighedOn: String(formData.get("date")),
    weightKg,
    notes: String(formData.get("notes") || ""),
  });
  revalidateTxnPaths();
}

export async function actionRecordBreeding(formData: FormData) {
  await guardWrite();
  const maleRaw = String(formData.get("maleAnimalId") || "").trim();
  const exposureStart = String(formData.get("exposureStart") || formData.get("dateCrossed") || "");
  const exposureEnd = String(formData.get("exposureEnd") || exposureStart);
  await recordBreeding({
    femaleId: Number(formData.get("femaleId")),
    buckName: String(formData.get("buckName")),
    maleAnimalId: maleRaw ? Number(maleRaw) : null,
    exposureStart,
    exposureEnd,
    notes: String(formData.get("notes") || ""),
  });
  revalidateTxnPaths();
}

export async function actionLogMilk(formData: FormData) {
  await guardWrite();
  await logMilkRecord({
    animalId: Number(formData.get("animalId")),
    date: String(formData.get("date")),
    session: String(formData.get("session") || "AM") as MilkSession,
    amount: parsePositiveAmount(String(formData.get("amount") || ""), "Milk amount"),
    unit: String(formData.get("unit") || "lb") as MilkUnit,
    measurementMethod: String(formData.get("measurementMethod") || "scale") as MilkMeasurementMethod,
    source: String(formData.get("source") || "farm-entered") as MilkSource,
    operator: String(formData.get("operator") || ""),
    notes: String(formData.get("notes") || ""),
  });
  revalidateTxnPaths();
}

export async function actionRecordLactation(formData: FormData) {
  await guardWrite();
  await recordLactation({
    animalId: Number(formData.get("animalId")),
    fresheningDate: String(formData.get("fresheningDate")),
    lactationNumber: Number(formData.get("lactationNumber") || 1),
    dryOffDate: String(formData.get("dryOffDate") || "") || null,
    notes: String(formData.get("notes") || ""),
  });
  revalidateTxnPaths();
}

export async function actionUpsertVetContact(formData: FormData) {
  await guardWrite();
  const idRaw = String(formData.get("id") || "").trim();
  await upsertVetContact({
    id: idRaw || undefined,
    role: String(formData.get("role") || "primary") as VetContactRole,
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    emergencyPhone: String(formData.get("emergencyPhone") || ""),
    address: String(formData.get("address") || ""),
    servicesOffered: String(formData.get("servicesOffered") || ""),
    acceptsNewClients: String(formData.get("acceptsNewClients") || "unknown"),
    vcprEstablished: String(formData.get("vcprEstablished") || "unknown"),
    notes: String(formData.get("notes") || ""),
  });
  revalidatePath("/vet");
  return { ok: true as const };
}

export async function actionDeleteVetContact(formData: FormData) {
  await guardWrite();
  await deleteVetContact(String(formData.get("id") || ""));
  revalidatePath("/vet");
  return { ok: true as const };
}

export async function actionUpdateBreeding(formData: FormData) {
  await guardWrite();
  const maleRaw = String(formData.get("maleAnimalId") || "").trim();
  const statusRaw = String(formData.get("status") || "").trim();
  const deliveredRaw = String(formData.get("deliveredDate") || "").trim();
  const ultrasoundRaw = String(formData.get("ultrasoundDate") || "").trim();
  const fetusRaw = String(formData.get("fetusCount") || "").trim();
  await updateBreeding({
    id: String(formData.get("id")),
    buckName: String(formData.get("buckName") || ""),
    maleAnimalId: maleRaw ? Number(maleRaw) : null,
    dateCrossed: String(formData.get("dateCrossed")),
    outcome: String(formData.get("outcome")) as import("@/lib/types").BreedingOutcome,
    status: statusRaw as import("@/lib/types").BreedingStatus | "",
    deliveredDate: deliveredRaw || null,
    ultrasoundDate: ultrasoundRaw || null,
    fetusCount: parseOptionalNonNegativeInteger(fetusRaw, "Kids on ultrasound"),
    notes: String(formData.get("notes") || "") || null,
  });
  const femaleId = Number(formData.get("femaleId"));
  if (femaleId && !Number.isNaN(femaleId)) {
    revalidatePath(`/animals/${femaleId}`);
  }
  revalidateTxnPaths();
}

export async function actionRecordBreedingUltrasound(
  formData: FormData
): Promise<UltrasoundActionResult> {
  await guardWrite();
  try {
    const file = formData.get("file");
    const pregnancyResult = String(formData.get("pregnancyResult") || "").trim();
    const kidCountRaw = String(formData.get("kidCount") || "").trim();
    const comments = String(formData.get("comments") || "").trim();

    let fetusCount: number | null = null;
    if (pregnancyResult === "confirmed") {
      const count = parsePositiveInteger(kidCountRaw, "Number of kids");
      fetusCount = count;
    } else if (pregnancyResult === "not_pregnant") {
      fetusCount = 0;
    }

    const id = String(formData.get("id") || "").trim();
    const femaleId = Number(formData.get("femaleId"));
    if (!id) return { ok: false, error: "Breeding record not found" };
    if (!femaleId || Number.isNaN(femaleId)) return { ok: false, error: "Goat not found" };

    await recordBreedingUltrasound({
      id,
      femaleId,
      ultrasoundDate: String(formData.get("ultrasoundDate")),
      fetusCount,
      comments: comments || null,
      file: file instanceof File && file.size > 0 ? file : null,
    });
    revalidatePath(`/animals/${femaleId}`);
    revalidateTxnPaths();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyUltrasoundError(err) };
  }
}

export async function actionDeleteBreeding(formData: FormData) {
  await guardWrite();
  const id = String(formData.get("id"));
  const femaleId = Number(formData.get("femaleId"));
  await deleteBreeding(id);
  if (femaleId && !Number.isNaN(femaleId)) {
    revalidatePath(`/animals/${femaleId}`);
  }
  revalidateTxnPaths();
}

export async function actionChangeStatus(formData: FormData) {
  await guardWrite();
  await changeStatus({
    animalId: Number(formData.get("animalId")),
    status: String(formData.get("status")) as AnimalStatus,
    outDate: String(formData.get("outDate") || "") || undefined,
  });
  revalidateTxnPaths();
}

export async function actionRecordLivestockSale(formData: FormData) {
  await guardWrite();
  try {
    const date = String(formData.get("date") || "").trim();
    const animalId = Number(formData.get("animalId"));
    const grossSalePrice = parsePositiveAmount(
      String(formData.get("grossSalePrice") || "").trim(),
      "Gross sale price"
    );
    const deliveryRaw = String(formData.get("deliveryCost") || "").trim();
    const additional = String(formData.get("additionalAnimalId") || "").trim();
    const receivedNowRaw = String(formData.get("amountReceivedNow") || "").trim();
    const buyerName = String(formData.get("buyerName") || "").trim();

    if (!date) return { ok: false, error: "Sale date is required" };
    if (!animalId || Number.isNaN(animalId)) return { ok: false, error: "Select a goat" };
    const receivedNow = receivedNowRaw !== ""
      ? parseNonNegativeAmount(receivedNowRaw, "Received now")
      : null;

    let notes = String(formData.get("notes") || "").trim();
    if (buyerName) {
      const prefix = `Sold to ${buyerName}`;
      notes = notes ? `${prefix} — ${notes}` : prefix;
    }

    await recordLivestockSale({
      date,
      animalId,
      additionalAnimalIds: additional ? [Number(additional)] : undefined,
      grossSalePrice,
      deliveryCost: deliveryRaw
        ? parseNonNegativeAmount(deliveryRaw, "Delivery cost", 0)
        : undefined,
      amountReceivedNow: receivedNow,
      buyerName: buyerName || null,
      notes: notes || undefined,
    });
    revalidateTxnPaths();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not record sale",
    };
  }
}

export async function actionDeleteSaleReceipt(formData: FormData) {
  await guardWrite();
  const txId = String(formData.get("txId") || "").trim();
  const animalId = Number(formData.get("animalId"));
  if (!txId) throw new Error("Receipt id is required");
  await deleteSaleReceipt(txId);
  if (animalId && !Number.isNaN(animalId)) {
    revalidatePath(`/animals/${animalId}`);
  }
  revalidateTxnPaths();
}

export async function actionUndoLivestockSale(formData: FormData) {
  await guardWrite();
  const animalId = Number(formData.get("animalId"));
  if (!animalId || Number.isNaN(animalId)) throw new Error("Animal id is required");
  await undoLivestockSale(animalId);
  revalidatePath(`/animals/${animalId}`);
  revalidateTxnPaths();
}

export async function actionAddPurchasePayment(formData: FormData) {
  await guardWrite();
  const amount = parsePositiveAmount(String(formData.get("amount") ?? ""));
  await addPurchasePayment({
    animalId: Number(formData.get("animalId")),
    date: String(formData.get("date")),
    amount,
    notes: String(formData.get("notes") || "") || undefined,
  });
  const id = Number(formData.get("animalId"));
  revalidatePath(`/animals/${id}`);
  revalidateTxnPaths();
}

export async function actionAddSaleReceipt(formData: FormData) {
  await guardWrite();
  const amount = parsePositiveAmount(String(formData.get("amount") ?? ""));
  await addSaleReceipt({
    animalId: Number(formData.get("animalId")),
    date: String(formData.get("date")),
    amount,
    notes: String(formData.get("notes") || "") || undefined,
  });
  const id = Number(formData.get("animalId"));
  revalidatePath(`/animals/${id}`);
  revalidateTxnPaths();
}

export async function actionUpdateTransaction(formData: FormData) {
  await guardWrite();
  const id = String(formData.get("id"));
  const variant = String(formData.get("variant")) as TransactionEditVariant;

  if (variant === "expense") {
    const animalRaw = String(formData.get("animalId") || "").trim();
    const category = await resolveExpenseCategory(formData);
    await updateTransaction({
      id,
      variant: "expense",
      date: String(formData.get("date")),
      amount: parsePositiveAmount(String(formData.get("amount") ?? "")),
      category: category as LedgerCategory,
      animalId: animalRaw ? Number(animalRaw) : null,
      notes: String(formData.get("notes") || "") || null,
    });
  } else if (variant === "livestock_purchase") {
    await updateTransaction({
      id,
      variant: "livestock_purchase",
      date: String(formData.get("date")),
      amount: parsePositiveAmount(String(formData.get("amount") ?? "")),
      vendorName: String(formData.get("vendorName") || ""),
      notes: String(formData.get("notes") || "") || null,
    });
  } else if (variant === "livestock_sale") {
    const additional = String(formData.get("additionalAnimalId") || "").trim();
    await updateTransaction({
      id,
      variant: "livestock_sale",
      date: String(formData.get("date")),
      animalId: Number(formData.get("animalId")),
      additionalAnimalIds: additional ? [Number(additional)] : undefined,
      grossSalePrice: parsePositiveAmount(
        String(formData.get("grossSalePrice") ?? ""),
        "Gross sale price"
      ),
      deliveryCost: parseNonNegativeAmount(
        String(formData.get("deliveryCost") ?? ""),
        "Delivery cost",
        0
      ),
      notes: String(formData.get("notes") || "") || null,
    });
  } else {
    throw new Error(`Unknown edit variant: ${variant}`);
  }

  revalidateTxnPaths();
}

export async function actionDeleteTransaction(formData: FormData) {
  await guardWrite();
  const id = String(formData.get("id"));
  await deleteTransaction(id);
  revalidateTxnPaths();
}

export async function actionUpdateAnimal(formData: FormData) {
  await guardWrite();
  const id = Number(formData.get("id"));
  const breedRaw = String(formData.get("breed") || "").trim();
  const sexRaw = String(formData.get("sex") || "").trim();
  const statusRaw = String(formData.get("status") || "").trim();
  const purchasePriceRaw = String(formData.get("purchasePrice") || "").trim();
  const purchasePaidRaw = String(formData.get("purchasePaid") || "").trim();
  const soldPriceRaw = String(formData.get("soldPrice") || "").trim();
  const saleDateRaw = String(formData.get("saleDate") || "").trim();
  const deliveryRaw = String(formData.get("deliveryCost") || "").trim();
  const receivedRaw = String(formData.get("amountReceived") || "").trim();
  const purchaseDateRaw = String(formData.get("purchaseDate") || "").trim();
  const outDateRaw = String(formData.get("outDate") || "").trim();
  const damRaw = String(formData.get("damId") || "").trim();
  const sireAnimalRaw = String(formData.get("sireAnimalId") || "").trim();
  const sireNameRaw = String(formData.get("sireName") || "").trim();
  const isBorn =
    formData.get("acquisitionType") === "born" ||
    formData.get("homeBred") === "on" ||
    formData.get("homeBred") === "true";

  await updateAnimal({
    id,
    name: String(formData.get("name") || "") || null,
    breed: breedRaw ? (breedRaw as AnimalBreed) : null,
    sex: sexRaw ? (sexRaw as AnimalSex) : null,
    registered_name: String(formData.get("registeredName") || "") || null,
    barn_name: String(formData.get("barnName") || "") || null,
    previous_name: String(formData.get("previousName") || "") || null,
    adga_registration_number: String(formData.get("adgaNumber") || "") || null,
    tattoo_right: String(formData.get("tattooRight") || "") || null,
    tattoo_left: String(formData.get("tattooLeft") || "") || null,
    tattoo_tail_web: String(formData.get("tattooTailWeb") || "") || null,
    eid_microchip: String(formData.get("eidMicrochip") || "") || null,
    scrapie_tag: String(formData.get("scrapieTag") || "") || null,
    farm_tag: String(formData.get("farmTag") || "") || null,
    description: String(formData.get("description") || "") || null,
    comment: String(formData.get("comment") || "") || null,
    ownerName: String(formData.get("ownerName")),
    vendorName: String(formData.get("vendorName") || "") || null,
    age_at_purchase: String(formData.get("ageAtPurchase") || "") || null,
    home_bred: isBorn,
    dam_id: isBorn && damRaw ? Number(damRaw) : isBorn ? null : null,
    sire_id: isBorn && sireAnimalRaw ? Number(sireAnimalRaw) : isBorn ? null : null,
    sire_name: isBorn && sireNameRaw ? sireNameRaw : isBorn ? null : null,
    status: statusRaw ? (statusRaw as AnimalStatus) : undefined,
    date_of_purchase: purchaseDateRaw || null,
    purchase_price: parseOptionalNonNegativeAmount(purchasePriceRaw, "Purchase price"),
    purchase_paid: parseOptionalNonNegativeAmount(purchasePaidRaw, "Amount paid"),
    out_date: outDateRaw || null,
    sold_price: parseOptionalNonNegativeAmount(soldPriceRaw, "Sold price"),
    sale_date: saleDateRaw || null,
    gross_sale_price: parseOptionalNonNegativeAmount(soldPriceRaw, "Sale price"),
    delivery_cost: parseOptionalNonNegativeAmount(deliveryRaw, "Delivery cost"),
    amount_received: parseOptionalNonNegativeAmount(receivedRaw, "Amount received"),
  });
  revalidatePath(`/animals/${id}`);
  revalidateTxnPaths();
}

export async function actionDeleteAnimal(formData: FormData) {
  await guardWrite();
  const animalId = Number(formData.get("animalId"));
  if (!animalId || Number.isNaN(animalId)) {
    throw new Error("Animal id is required");
  }
  await deleteAnimal(animalId);
  revalidateTxnPaths();
  redirect("/animals");
}

export async function actionUploadAnimalMedia(formData: FormData) {
  await guardWrite();
  const animalId = Number(formData.get("animalId"));
  const file = formData.get("file");
  const caption = String(formData.get("caption") || "") || null;
  if (!(file instanceof File) || !file.size) {
    throw new Error("File is required");
  }
  await uploadAnimalMedia({ animalId, file, caption });
  revalidatePath(`/animals/${animalId}`);
  revalidatePath("/animals");
}

/** Batch-sign media storage paths after first paint (client gallery). */
export async function actionSignMediaUrls(
  paths: string[]
): Promise<Record<string, string | null>> {
  const { signedMediaUrl } = await import("@/lib/media/upload");
  const entries = await Promise.all(
    paths.map(async (p) => [p, await signedMediaUrl(p)] as const)
  );
  return Object.fromEntries(entries);
}

export async function actionSignOut() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
