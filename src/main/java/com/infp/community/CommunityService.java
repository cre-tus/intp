package com.infp.community;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infp.community.dto.CommunityPostCommentRequest;
import com.infp.community.dto.CommunityPostCommentResponse;
import com.infp.community.dto.CommunityPostReactionResponse;
import com.infp.community.dto.CommunityPostRequest;
import com.infp.community.dto.CommunityPostResponse;
import com.infp.community.dto.CommunityPlanViewResponse;
import com.infp.community.dto.CommunityUserProfileResponse;
import com.infp.travel.TravelPlanEntity;
import com.infp.travel.TravelPlanRepository;
import com.infp.travel.TravelPlanService;
import com.infp.travel.dto.TravelPlanResponse;
import com.infp.follow.UserFollowRepository;
import com.infp.user.entity.User;
import com.infp.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
public class CommunityService {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final long MAX_POSTS_PER_USER = 10;

    private final CommunityPostRepository postRepository;
    private final CommunityPostLikeRepository likeRepository;
    private final CommunityPostSaveRepository saveRepository;
    private final CommunityPostCommentRepository commentRepository;
    private final UserFollowRepository followRepository;
    private final TravelPlanRepository travelPlanRepository;
    private final TravelPlanService travelPlanService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CommunityService(
            CommunityPostRepository postRepository,
            CommunityPostLikeRepository likeRepository,
            CommunityPostSaveRepository saveRepository,
            CommunityPostCommentRepository commentRepository,
            UserFollowRepository followRepository,
            TravelPlanRepository travelPlanRepository,
            TravelPlanService travelPlanService,
            UserRepository userRepository
    ) {
        this.postRepository = postRepository;
        this.likeRepository = likeRepository;
        this.saveRepository = saveRepository;
        this.commentRepository = commentRepository;
        this.followRepository = followRepository;
        this.travelPlanRepository = travelPlanRepository;
        this.travelPlanService = travelPlanService;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<CommunityPostResponse> list(Long viewerId) {
        return postRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map((post) -> toResponse(post, viewerId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CommunityPostResponse> myPosts(long userId) {
        return postRepository.findAllByAuthor_IdOrderByCreatedAtDesc(userId).stream()
                .map((post) -> toResponse(post, userId))
                .toList();
    }

    @Transactional(readOnly = true)
    public CommunityUserProfileResponse userProfile(Long viewerId, long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        String nickname = displayName(user);
        List<CommunityPostEntity> posts = postRepository.findAllByAuthor_IdOrderByCreatedAtDesc(userId);
        long sharedPlans = posts.stream()
                .filter((post) -> post.getPlan() != null)
                .count();
        boolean hasViewer = viewerId != null;
        boolean ownProfile = hasViewer && user.getId().equals(viewerId);
        return new CommunityUserProfileResponse(
                user.getId(),
                nickname,
                "@" + user.getEmail().split("@")[0],
                avatar(user, nickname),
                user.getStatusMessage() == null ? "" : user.getStatusMessage(),
                followRepository.countByFollowing_Id(userId),
                followRepository.countByFollower_Id(userId),
                posts.size(),
                sharedPlans,
                hasViewer && !ownProfile && followRepository.existsByFollower_IdAndFollowing_Id(viewerId, userId),
                ownProfile,
                posts.stream()
                        .map((post) -> toResponse(post, viewerId))
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public List<CommunityPostResponse> savedPosts(long userId) {
        return saveRepository.findAllByUser_IdOrderByCreatedAtDesc(userId).stream()
                .map(CommunityPostSaveEntity::getPost)
                .map((post) -> toResponse(post, userId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CommunityPostResponse> followingPosts(long userId) {
        return postRepository.findFollowingPosts(userId).stream()
                .map((post) -> toResponse(post, userId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CommunityPostResponse> popularPosts(Long viewerId) {
        return postRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map((post) -> toResponse(post, viewerId))
                .sorted(Comparator
                        .comparingLong(CommunityPostResponse::likes).reversed()
                        .thenComparing(CommunityPostResponse::createdAt, Comparator.reverseOrder()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CommunityPostResponse> search(Long viewerId, String keyword, String region) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        String normalizedRegion = region == null ? "" : region.trim();
        List<CommunityPostEntity> posts;
        if (!normalizedKeyword.isBlank()) {
            posts = postRepository.searchTop50(normalizedKeyword);
        } else if (!normalizedRegion.isBlank()) {
            posts = postRepository.findTop50ByCityContainingIgnoreCaseOrderByCreatedAtDesc(normalizedRegion);
        } else {
            posts = postRepository.findTop50ByOrderByCreatedAtDesc();
        }
        return posts.stream()
                .filter((post) -> normalizedRegion.isBlank()
                        || post.getCity().toLowerCase().contains(normalizedRegion.toLowerCase()))
                .map((post) -> toResponse(post, viewerId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> regions(String keyword) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        return postRepository.findDistinctCities(normalizedKeyword).stream()
                .filter((city) -> city != null && !city.isBlank())
                .limit(30)
                .toList();
    }

    @Transactional(readOnly = true)
    public CommunityPlanViewResponse getSharedPlan(long postId) {
        CommunityPostEntity post = requirePost(postId);
        TravelPlanEntity plan = post.getPlan();
        if (plan == null) {
            throw new IllegalArgumentException("공유된 여행 계획이 없는 피드입니다.");
        }
        return new CommunityPlanViewResponse(
                post.getId(),
                plan.getExternalId(),
                post.getTitle(),
                displayName(post.getAuthor()),
                plan.getTitle(),
                plan.getTemplate(),
                plan.getTier(),
                plan.getContentJson(),
                plan.getCreatedAt(),
                plan.getUpdatedAt()
        );
    }

    @Transactional
    public TravelPlanResponse copySharedPlan(long userId, long postId) {
        CommunityPostEntity post = requirePost(postId);
        if (post.getPlan() == null) {
            throw new IllegalArgumentException("복사할 여행 계획이 없는 피드입니다.");
        }
        if (post.getAuthor().getId().equals(userId)) {
            throw new IllegalArgumentException("내가 공유한 여행 계획은 복사할 수 없습니다.");
        }
        return travelPlanService.copyFromSharedPlan(userId, post.getPlan(), displayName(post.getAuthor()));
    }

    @Transactional
    public CommunityPostResponse create(long userId, CommunityPostRequest request) {
        User author = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        if (postRepository.countByAuthor_Id(userId) >= MAX_POSTS_PER_USER) {
            throw new IllegalArgumentException("커뮤니티 피드는 최대 10개까지만 올릴 수 있습니다.");
        }

        TravelPlanEntity plan = resolveOwnedPlan(request.planId(), userId);

        CommunityPostEntity post = new CommunityPostEntity();
        post.setAuthor(author);
        post.setPlan(plan);
        post.setTitle(plan == null ? blankToEmpty(request.title(), 160) : required(request.title(), "제목을 입력해주세요.", 160));
        post.setCity(plan == null ? blankToEmpty(request.city(), 80) : required(request.city(), "도시를 입력해주세요.", 80));
        post.setDuration(plan == null ? blankToEmpty(request.duration(), 40) : required(request.duration(), "여행 기간을 입력해주세요.", 40));
        post.setBudget(plan == null ? blankToEmpty(request.budget(), 40) : required(request.budget(), "예산을 입력해주세요.", 40));
        post.setImageKey(normalizeImageKey(request.imageKey()));
        post.setImageUrl(optional(request.imageUrl(), 600_000));
        post.setCaption(required(request.caption(), "소개 내용을 입력해주세요.", 2000));
        post.setTagsJson(writeList(limitList(request.tags(), 8, 24)));
        post.setRouteJson(writeList(limitList(request.route(), 10, 40)));

        return toResponse(postRepository.save(post), userId);
    }

    @Transactional
    public CommunityPostResponse update(long userId, long postId, CommunityPostRequest request) {
        CommunityPostEntity post = requirePost(postId);
        if (!post.getAuthor().getId().equals(userId)) {
            throw new IllegalArgumentException("내가 작성한 커뮤니티 글만 수정할 수 있습니다.");
        }
        post.setPlan(resolveOwnedPlan(request.planId(), userId));
        TravelPlanEntity plan = post.getPlan();
        post.setTitle(plan == null ? blankToEmpty(request.title(), 160) : required(request.title(), "제목을 입력해주세요.", 160));
        post.setCity(plan == null ? blankToEmpty(request.city(), 80) : required(request.city(), "도시를 입력해주세요.", 80));
        post.setDuration(plan == null ? blankToEmpty(request.duration(), 40) : required(request.duration(), "여행 기간을 입력해주세요.", 40));
        post.setBudget(plan == null ? blankToEmpty(request.budget(), 40) : required(request.budget(), "예산을 입력해주세요.", 40));
        post.setImageKey(normalizeImageKey(request.imageKey()));
        post.setImageUrl(optional(request.imageUrl(), 600_000));
        post.setCaption(required(request.caption(), "소개 내용을 입력해주세요.", 2000));
        post.setTagsJson(writeList(limitList(request.tags(), 8, 24)));
        post.setRouteJson(writeList(limitList(request.route(), 10, 40)));
        return toResponse(postRepository.save(post), userId);
    }

    private TravelPlanEntity resolveOwnedPlan(String planIdValue, long userId) {
        String planId = optional(planIdValue, 100);
        if (planId == null) return null;
        TravelPlanEntity plan = travelPlanRepository.findByExternalId(planId)
                .orElseThrow(() -> new IllegalArgumentException("공유할 여행 계획을 찾을 수 없습니다."));
        if (!plan.getOwner().getId().equals(userId)) {
            throw new IllegalArgumentException("내가 만든 여행 계획만 커뮤니티에 공유할 수 있습니다.");
        }
        return plan;
    }

    @Transactional
    public CommunityPostReactionResponse toggleLike(long userId, long postId) {
        CommunityPostEntity post = requirePost(postId);
        if (likeRepository.existsByPost_IdAndUser_Id(postId, userId)) {
            likeRepository.deleteByPost_IdAndUser_Id(postId, userId);
            return new CommunityPostReactionResponse(postId, false, likeRepository.countByPost_Id(postId));
        }

        User user = requireUser(userId);
        CommunityPostLikeEntity like = new CommunityPostLikeEntity();
        like.setPost(post);
        like.setUser(user);
        likeRepository.save(like);
        return new CommunityPostReactionResponse(postId, true, likeRepository.countByPost_Id(postId));
    }

    @Transactional
    public CommunityPostReactionResponse toggleSave(long userId, long postId) {
        CommunityPostEntity post = requirePost(postId);
        if (saveRepository.existsByPost_IdAndUser_Id(postId, userId)) {
            saveRepository.deleteByPost_IdAndUser_Id(postId, userId);
            return new CommunityPostReactionResponse(postId, false, saveRepository.countByPost_Id(postId));
        }

        User user = requireUser(userId);
        CommunityPostSaveEntity save = new CommunityPostSaveEntity();
        save.setPost(post);
        save.setUser(user);
        saveRepository.save(save);
        return new CommunityPostReactionResponse(postId, true, saveRepository.countByPost_Id(postId));
    }

    @Transactional(readOnly = true)
    public List<CommunityPostCommentResponse> comments(long postId, Long viewerId) {
        requirePost(postId);
        return commentRepository.findTop30ByPost_IdOrderByCreatedAtAsc(postId).stream()
                .map((comment) -> toCommentResponse(comment, viewerId))
                .toList();
    }

    @Transactional
    public CommunityPostCommentResponse addComment(long userId, long postId, CommunityPostCommentRequest request) {
        CommunityPostEntity post = requirePost(postId);
        CommunityPostCommentEntity comment = new CommunityPostCommentEntity();
        comment.setPost(post);
        comment.setUser(requireUser(userId));
        comment.setContent(required(request.content(), "댓글 내용을 입력해주세요.", 600));
        return toCommentResponse(commentRepository.save(comment), userId);
    }

    @Transactional
    public CommunityPostCommentResponse updateComment(long userId, long postId, long commentId, CommunityPostCommentRequest request) {
        CommunityPostCommentEntity comment = requireComment(postId, commentId);
        if (!comment.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("내가 작성한 댓글만 수정할 수 있습니다.");
        }
        comment.setContent(required(request.content(), "댓글 내용을 입력해주세요.", 600));
        return toCommentResponse(commentRepository.save(comment), userId);
    }

    @Transactional
    public void deleteComment(long userId, long postId, long commentId) {
        CommunityPostCommentEntity comment = requireComment(postId, commentId);
        if (!comment.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("내가 작성한 댓글만 삭제할 수 있습니다.");
        }
        commentRepository.delete(comment);
    }

    @Transactional
    public void deletePost(long userId, long postId) {
        CommunityPostEntity post = requirePost(postId);
        if (!post.getAuthor().getId().equals(userId)) {
            throw new IllegalArgumentException("내가 작성한 커뮤니티 글만 삭제할 수 있습니다.");
        }
        postRepository.delete(post);
    }

    private CommunityPostEntity requirePost(long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("커뮤니티 게시글을 찾을 수 없습니다."));
    }

    private User requireUser(long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    private CommunityPostCommentEntity requireComment(long postId, long commentId) {
        CommunityPostCommentEntity comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("댓글을 찾을 수 없습니다."));
        if (!comment.getPost().getId().equals(postId)) {
            throw new IllegalArgumentException("해당 피드의 댓글이 아닙니다.");
        }
        return comment;
    }

    private CommunityPostResponse toResponse(CommunityPostEntity post, Long viewerId) {
        User author = post.getAuthor();
        String authorName = displayName(author);
        String handle = "@" + author.getEmail().split("@")[0];
        boolean hasViewer = viewerId != null;

        return new CommunityPostResponse(
                post.getId(),
                post.getPlan() == null ? null : post.getPlan().getExternalId(),
                author.getId(),
                authorName,
                handle,
                avatar(author, authorName),
                post.getTitle(),
                post.getCity(),
                post.getDuration(),
                post.getBudget(),
                post.getImageKey(),
                post.getImageUrl(),
                post.getCaption(),
                readList(post.getTagsJson()),
                readList(post.getRouteJson()),
                likeRepository.countByPost_Id(post.getId()),
                commentRepository.countByPost_Id(post.getId()),
                saveRepository.countByPost_Id(post.getId()),
                hasViewer && likeRepository.existsByPost_IdAndUser_Id(post.getId(), viewerId),
                hasViewer && saveRepository.existsByPost_IdAndUser_Id(post.getId(), viewerId),
                hasViewer && !author.getId().equals(viewerId) && followRepository.existsByFollower_IdAndFollowing_Id(viewerId, author.getId()),
                hasViewer && author.getId().equals(viewerId),
                post.getCreatedAt()
        );
    }

    private String required(String value, String message, int maxLength) {
        if (value == null || value.trim().isBlank()) throw new IllegalArgumentException(message);
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }

    private String optional(String value, int maxLength) {
        if (value == null || value.trim().isBlank()) return null;
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }

    private String blankToEmpty(String value, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }

    private String normalizeImageKey(String value) {
        String key = value == null ? "" : value.trim().toLowerCase();
        return switch (key) {
            case "osaka", "sapporo", "fukuoka", "nagoya" -> key;
            default -> "tokyo";
        };
    }

    private List<String> limitList(List<String> values, int maxItems, int maxLength) {
        if (values == null) return List.of();
        return values.stream()
                .map((value) -> value == null ? "" : value.trim())
                .filter((value) -> !value.isBlank())
                .distinct()
                .limit(maxItems)
                .map((value) -> value.length() > maxLength ? value.substring(0, maxLength) : value)
                .toList();
    }

    private String writeList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("커뮤니티 게시글 데이터를 저장할 수 없습니다.");
        }
    }

    private List<String> readList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    private CommunityPostCommentResponse toCommentResponse(CommunityPostCommentEntity comment, Long viewerId) {
        String authorName = displayName(comment.getUser());
        boolean edited = comment.getUpdatedAt() != null && comment.getCreatedAt() != null
                && comment.getUpdatedAt().isAfter(comment.getCreatedAt().plusSeconds(1));
        return new CommunityPostCommentResponse(
                comment.getId(),
                comment.getPost().getId(),
                comment.getUser().getId(),
                authorName,
                avatar(comment.getUser(), authorName),
                comment.getContent(),
                viewerId != null && comment.getUser().getId().equals(viewerId),
                edited,
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value.trim();
        }
        return "여행자";
    }

    private String displayName(User author) {
        String fallbackName = (author.getFirstName() == null ? "" : author.getFirstName())
                + (author.getLastName() == null ? "" : author.getLastName());
        return firstNonBlank(author.getNickname(), fallbackName, author.getEmail());
    }

    private String initials(String name) {
        String trimmed = firstNonBlank(name);
        if (trimmed.length() <= 2) return trimmed.toUpperCase();
        return trimmed.substring(0, 2).toUpperCase();
    }

    private String avatar(User user, String displayName) {
        if (user.getProfileImageUrl() != null && !user.getProfileImageUrl().isBlank()) {
            return user.getProfileImageUrl();
        }
        return initials(displayName);
    }
}
