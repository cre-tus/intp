from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import nn


@dataclass
class ModelConfig:
    age_bucket_count: int
    time_bucket_count: int
    companion_type_count: int
    child_age_bucket_count: int
    group_age_bucket_count: int
    month_bucket_count: int
    season_bucket_count: int
    place_count: int
    category_count: int
    embedding_dim: int = 32


class TravelRecommender(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.age_embedding = nn.Embedding(config.age_bucket_count, config.embedding_dim)
        self.time_embedding = nn.Embedding(config.time_bucket_count, config.embedding_dim)
        self.companion_embedding = nn.Embedding(config.companion_type_count, config.embedding_dim)
        self.child_age_embedding = nn.Embedding(config.child_age_bucket_count, config.embedding_dim)
        self.group_age_embedding = nn.Embedding(config.group_age_bucket_count, config.embedding_dim)
        self.month_embedding = nn.Embedding(config.month_bucket_count, config.embedding_dim)
        self.season_embedding = nn.Embedding(config.season_bucket_count, config.embedding_dim)
        self.place_embedding = nn.Embedding(config.place_count, config.embedding_dim)
        self.category_embedding = nn.Embedding(config.category_count, config.embedding_dim)
        input_dim = config.embedding_dim * 9 + 4
        self.scorer = nn.Sequential(
            nn.Linear(input_dim, 96),
            nn.ReLU(),
            nn.Dropout(0.12),
            nn.Linear(96, 48),
            nn.ReLU(),
            nn.Linear(48, 1),
        )

    def forward(
        self,
        age_bucket: torch.Tensor,
        time_bucket: torch.Tensor,
        companion_type: torch.Tensor,
        child_age_bucket: torch.Tensor,
        group_age_bucket: torch.Tensor,
        month_bucket: torch.Tensor,
        season_bucket: torch.Tensor,
        place_id: torch.Tensor,
        category_id: torch.Tensor,
        numeric: torch.Tensor,
    ) -> torch.Tensor:
        features = torch.cat(
            [
                self.age_embedding(age_bucket),
                self.time_embedding(time_bucket),
                self.companion_embedding(companion_type),
                self.child_age_embedding(child_age_bucket),
                self.group_age_embedding(group_age_bucket),
                self.month_embedding(month_bucket),
                self.season_embedding(season_bucket),
                self.place_embedding(place_id),
                self.category_embedding(category_id),
                numeric,
            ],
            dim=1,
        )
        return self.scorer(features).squeeze(1)
