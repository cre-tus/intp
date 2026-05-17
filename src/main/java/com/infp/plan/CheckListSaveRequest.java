package com.infp.plan;

import java.util.List;

public class CheckListSaveRequest {
    private Long planId;
    private List<ChecklistItemRequest> checklistItems;

    public Long getPlanId() {
        return planId;
    }

    public List<ChecklistItemRequest> getChecklistItems() {
        return checklistItems;
    }

    public static class ChecklistItemRequest {
        private String itemName;
        private Integer cost;
        private Boolean checked;

        public String getItemName() {
            return itemName;
        }

        public Integer getCost() {
            return cost;
        }

        public Boolean getChecked() {
            return checked;
        }
    }
}
