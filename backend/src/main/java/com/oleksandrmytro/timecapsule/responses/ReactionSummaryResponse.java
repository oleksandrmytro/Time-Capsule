package com.oleksandrmytro.timecapsule.responses;

import java.util.List;
import java.util.Map;

public class ReactionSummaryResponse {
    private Map<String, Long> counts;
    private List<String> userReactions;

    public ReactionSummaryResponse() {}

    public ReactionSummaryResponse(Map<String, Long> counts, List<String> userReactions) {
        this.counts = counts;
        this.userReactions = userReactions;
    }

    public Map<String, Long> getCounts() { return counts; }
    public void setCounts(Map<String, Long> counts) { this.counts = counts; }
    public List<String> getUserReactions() { return userReactions; }
    public void setUserReactions(List<String> userReactions) { this.userReactions = userReactions; }
}

