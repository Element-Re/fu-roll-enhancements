class SelectionHistoryEntry {
    iteration;

    // "priority" | "standard"
    sourcePool;

    // Snapshot of candidate IDs at selection time
    candidateTargetIds = [];

    // Chosen target
    selectedTargetId = null;

    // Optional metadata
    metadata = {};

    constructor({
                    iteration,
                    sourcePool,
                    candidateTargetIds,
                    selectedTargetId,
                    metadata = {}
                }) {
        this.iteration = iteration;
        this.sourcePool = sourcePool;
        this.candidateTargetIds = [...candidateTargetIds];
        this.selectedTargetId = selectedTargetId;
        this.metadata = metadata;
    }
}