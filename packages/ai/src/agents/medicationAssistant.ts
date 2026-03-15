import { retrieveGuidanceContext } from "../embeddings";
import { runWithTools } from "../runner";
import { localTools } from "../tools/index";

function embedQuestion(question: string): number[] {
  const values = new Array(8).fill(0);
  for (let i = 0; i < question.length; i += 1) {
    values[i % values.length] += question.charCodeAt(i) / 1000;
  }
  return values;
}

export async function askMedicationAssistant(params: {
  question: string;
  prescriptionId: string;
}) {
  const retrievedContext = await retrieveGuidanceContext(embedQuestion(params.question), 3);
  const contextBlock = retrievedContext.length
    ? `Medication guidance context:\n${retrievedContext.join("\n---\n")}`
    : "No additional guidance context found.";

  return runWithTools({
    systemPrompt: [
      "You are a medication assistant for a prescription companion app.",
      "Answer the patient's question directly and concisely.",
      "Use the available tools when you need prescription details, schedule information, or a drug interaction lookup.",
      "If the available data is incomplete, say that clearly and avoid making up medical facts.",
      "Do not mention internal tool names in the final answer."
    ].join(" "),
    userInstruction: [
      `Prescription ID: ${params.prescriptionId}`,
      contextBlock,
      `Patient question: ${params.question}`
    ].join("\n"),
    tools: [
      {
        name: "getPrescriptionDetails",
        description: "Get the prescription's medication name, dosage, frequency, instructions, and follow-up recommendation.",
        parameters: {
          type: "object",
          properties: {
            prescriptionId: {
              type: "string",
              description: "The prescription ID to look up."
            }
          },
          required: ["prescriptionId"],
          additionalProperties: false
        },
        handler: async (args) => localTools.getPrescriptionDetails(String(args.prescriptionId ?? params.prescriptionId))
      },
      {
        name: "getMedicationSchedule",
        description: "Get the medication dose schedule for a prescription.",
        parameters: {
          type: "object",
          properties: {
            prescriptionId: {
              type: "string",
              description: "The prescription ID to look up."
            }
          },
          required: ["prescriptionId"],
          additionalProperties: false
        },
        handler: async (args) => localTools.getMedicationSchedule(String(args.prescriptionId ?? params.prescriptionId))
      },
      {
        name: "checkDrugInteraction",
        description: "Check for a possible interaction between two medications.",
        parameters: {
          type: "object",
          properties: {
            medicationA: {
              type: "string",
              description: "The first medication name."
            },
            medicationB: {
              type: "string",
              description: "The second medication name."
            }
          },
          required: ["medicationA", "medicationB"],
          additionalProperties: false
        },
        handler: async (args) =>
          localTools.checkDrugInteraction({
            medicationA: String(args.medicationA ?? ""),
            medicationB: String(args.medicationB ?? "")
          })
      }
    ]
  });
}
