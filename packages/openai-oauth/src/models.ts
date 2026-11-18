import { isGptImageModel, type OpenAIOAuthTransport } from "@openai-oauth/core"

type ModelResolver = () => Promise<string[]>

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value)

const visibleModelIds = (ids: string[]): string[] => [
	...new Set(ids.filter((id) => !isGptImageModel(id))),
]

const modelListError = (bodyText: string): string => {
	try {
		const parsed = JSON.parse(bodyText)
		if (
			isRecord(parsed) &&
			isRecord(parsed.error) &&
			typeof parsed.error.message === "string"
		) {
			return parsed.error.message
		}
	} catch {}

	return bodyText || "Failed to load models from Codex."
}

const readModelList = async (
	client: OpenAIOAuthTransport,
): Promise<string[]> => {
	const response = await client.request("/models")
	const bodyText = await response.text()

	if (!response.ok) {
		throw new Error(modelListError(bodyText))
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(bodyText)
	} catch {
		throw new Error("Codex returned an invalid models response.")
	}

	if (!isRecord(parsed) || !Array.isArray(parsed.data)) {
		throw new Error("Codex returned a malformed models response.")
	}

	return visibleModelIds(
		parsed.data
			.map((model) => (isRecord(model) ? model.id : undefined))
			.filter((id): id is string => typeof id === "string" && id.length > 0),
	)
}

export const resolveOpenAIOAuthModels = async (
	client: OpenAIOAuthTransport,
	configuredModels: string[] | undefined,
): Promise<string[]> =>
	Array.isArray(configuredModels) && configuredModels.length > 0
		? visibleModelIds(configuredModels)
		: readModelList(client)

export const createModelResolver =
	(
		client: OpenAIOAuthTransport,
		configuredModels: string[] | undefined,
	): ModelResolver =>
	() =>
		resolveOpenAIOAuthModels(client, configuredModels)
