import { z } from "zod";

export const callTypeSchema = z.enum(["voice", "video"]);

export const callParticipantSchema = z
  .object({
    id: z.number().int().positive(),
    nome: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254),
    avatarUrl: z.string().trim().min(1).max(700).nullable().optional(),
  })
  .strict();

export const serverCallParticipantSchema = callParticipantSchema.omit({
  avatarUrl: true,
});

export const callDetailsSchema = z
  .object({
    callId: z.string().trim().min(1).max(120),
    chatId: z.number().int().positive(),
    callerId: z.number().int().positive(),
    receiverId: z.number().int().positive(),
    type: callTypeSchema,
    startedAt: z.string().datetime({ offset: true }),
    acceptedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const startCallPayloadSchema = z
  .object({
    chatId: z.number().int().positive(),
    type: callTypeSchema,
  })
  .strict();

export const callActionPayloadSchema = z
  .object({
    callId: z.string().trim().min(1).max(120),
    chatId: z.number().int().positive(),
  })
  .strict();

export const incomingCallSchema = callDetailsSchema
  .extend({
    fromUser: serverCallParticipantSchema,
  })
  .strict();

export const acceptedCallSchema = callDetailsSchema
  .extend({
    acceptedBy: z.number().int().positive(),
  })
  .strict();

export const rejectedCallSchema = callDetailsSchema
  .extend({
    rejectedBy: z.number().int().positive(),
  })
  .strict();

export const endedCallSchema = callDetailsSchema
  .extend({
    endedBy: z.number().int().positive(),
  })
  .strict();

const offerDescriptionSchema = z
  .object({
    type: z.literal("offer"),
    sdp: z.string().min(1),
  })
  .strict();

const answerDescriptionSchema = z
  .object({
    type: z.literal("answer"),
    sdp: z.string().min(1),
  })
  .strict();

const iceCandidateSchema = z
  .object({
    candidate: z.string(),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
    usernameFragment: z.string().nullable().optional(),
  })
  .strict();

export const callSignalSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("offer"),
      sdp: offerDescriptionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("answer"),
      sdp: answerDescriptionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("candidate"),
      candidate: iceCandidateSchema,
    })
    .strict(),
]);

export const callSignalEventSchema = z
  .object({
    callId: z.string().trim().min(1).max(120),
    chatId: z.number().int().positive(),
    fromUserId: z.number().int().positive(),
    signal: callSignalSchema,
  })
  .strict();

export const callSignalPayloadSchema = callActionPayloadSchema
  .extend({
    signal: callSignalSchema,
  })
  .strict();

export const clientErrorSchema = z
  .object({
    code: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(500),
    statusCode: z.number().int().min(400).max(599),
    fields: z
      .array(
        z
          .object({
            path: z.string(),
            message: z.string(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const failedAckSchema = z
  .object({
    success: z.literal(false),
    error: clientErrorSchema,
  })
  .strict();

export const startCallAckSchema = z.discriminatedUnion("success", [
  z
    .object({
      success: z.literal(true),
      data: callDetailsSchema
        .extend({
          targetUser: serverCallParticipantSchema,
        })
        .strict(),
    })
    .strict(),
  failedAckSchema,
]);

export const acceptCallAckSchema = z.discriminatedUnion("success", [
  z
    .object({
      success: z.literal(true),
      data: callDetailsSchema,
    })
    .strict(),
  failedAckSchema,
]);

const endedActionDataSchema = z
  .object({
    ended: z.literal(true),
    callId: z.string().trim().min(1).max(120),
  })
  .strict();

export const endCallAckSchema = z.discriminatedUnion("success", [
  z
    .object({
      success: z.literal(true),
      data: endedActionDataSchema,
    })
    .strict(),
  failedAckSchema,
]);

export const iceServerSchema = z
  .object({
    urls: z.union([
      z.string().trim().min(1),
      z.array(z.string().trim().min(1)).min(1),
    ]),
    username: z.string().optional(),
    credential: z.string().optional(),
    credentialType: z.enum(["password", "oauth"]).optional(),
  })
  .strict();

export const iceServersSchema = z.array(iceServerSchema).min(1);

export type CallType = z.infer<typeof callTypeSchema>;
export type CallParticipant = z.infer<typeof callParticipantSchema>;
export type CallDetails = z.infer<typeof callDetailsSchema>;
export type IncomingCall = z.infer<typeof incomingCallSchema>;
export type AcceptedCall = z.infer<typeof acceptedCallSchema>;
export type RejectedCall = z.infer<typeof rejectedCallSchema>;
export type EndedCall = z.infer<typeof endedCallSchema>;
export type CallSignal = z.infer<typeof callSignalSchema>;
export type CallSignalEvent = z.infer<typeof callSignalEventSchema>;
