package com.infp.community;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infp.community.dto.CommunityPostCommentRequest;
import com.infp.community.dto.CommunityPostCommentResponse;
import com.infp.community.dto.CommunityCommentReactionResponse;
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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
    private final CommunityPostCommentLikeRepository commentLikeRepository;
    private final CommunityPostMediaRepository mediaRepository;
    private final CommunityMediaStorageService mediaStorageService;
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
            CommunityPostCommentLikeRepository commentLikeRepository,
            CommunityPostMediaRepository mediaRepository,
            CommunityMediaStorageService mediaStorageService,
            UserFollowRepository followRepository,
            TravelPlanRepository travelPlanRepository,
            TravelPlanService travelPlanService,
            UserRepository userRepository
    ) {
        this.postRepository = postRepository;
        this.likeRepository = likeRepository;
        this.saveRepository = saveRepository;
        this.commentRepository = commentRepository;
        this.commentLikeRepository = commentLikeRepository;
        this.mediaRepository = mediaRepository;
        this.mediaStorageService = mediaStorageService;
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

        String postType = normalizePostType(request.postType(), request.planId());
        TravelPlanEntity plan = "plan".equals(postType) ? resolveOwnedPlan(request.planId(), userId) : null;

        CommunityPostEntity post = new CommunityPostEntity();
        post.setAuthor(author);
        post.setPlan(plan);
        post.setPostType(postType);
        post.setTitle("photo".equals(postType) ? blankToEmpty(request.title(), 160) : required(request.title(), "제목을 입력해주세요.", 160));
        post.setCity(plan == null ? blankToEmpty(request.city(), 80) : required(request.city(), "도시를 입력해주세요.", 80));
        post.setDuration(plan == null ? blankToEmpty(request.duration(), 40) : required(request.duration(), "여행 기간을 입력해주세요.", 40));
        post.setBudget(plan == null ? blankToEmpty(request.budget(), 40) : required(request.budget(), "예산을 입력해주세요.", 40));
        post.setImageKey(normalizeImageKey(request.imageKey()));
        post.setImageUrl(optional(request.imageUrl(), 8_000_000));
        post.setMediaType("qna".equals(postType) ? normalizeMediaType(request.mediaType(), request.mediaUrl()) : null);
        post.setMediaUrl("qna".equals(postType) ? optional(request.mediaUrl(), 600) : null);
        post.setCaption("qna".equals(postType) ? required(request.questionDetail(), "질문 내용을 입력해주세요.", 2000) : required(request.caption(), "소개 내용을 입력해주세요.", 2000));
        post.setQuestionDetail("qna".equals(postType) ? required(request.questionDetail(), "질문 내용을 입력해주세요.", 3000) : null);
        post.setAttempted("qna".equals(postType) ? optional(request.attempted(), 1200) : null);
        post.setAnswerPreference("qna".equals(postType) ? optional(request.answerPreference(), 160) : null);
        post.setTagsJson(writeList(limitList(request.tags(), 8, 24)));
        post.setRouteJson(writeList(limitList(request.route(), 10, 40)));

        CommunityPostEntity saved = postRepository.save(post);
        syncMedia(saved, request);
        return toResponse(saved, userId);
    }

    @Transactional
    public CommunityPostResponse update(long userId, long postId, CommunityPostRequest request) {
        CommunityPostEntity post = requirePost(postId);
        if (!post.getAuthor().getId().equals(userId)) {
            throw new IllegalArgumentException("내가 작성한 커뮤니티 글만 수정할 수 있습니다.");
        }
        String postType = normalizePostType(request.postType(), request.planId());
        post.setPostType(postType);
        post.setPlan("plan".equals(postType) ? resolveOwnedPlan(request.planId(), userId) : null);
        TravelPlanEntity plan = post.getPlan();
        post.setTitle("photo".equals(postType) ? blankToEmpty(request.title(), 160) : required(request.title(), "제목을 입력해주세요.", 160));
        post.setCity(plan == null ? blankToEmpty(request.city(), 80) : required(request.city(), "도시를 입력해주세요.", 80));
        post.setDuration(plan == null ? blankToEmpty(request.duration(), 40) : required(request.duration(), "여행 기간을 입력해주세요.", 40));
        post.setBudget(plan == null ? blankToEmpty(request.budget(), 40) : required(request.budget(), "예산을 입력해주세요.", 40));
        post.setImageKey(normalizeImageKey(request.imageKey()));
        post.setImageUrl(optional(request.imageUrl(), 8_000_000));
        post.setMediaType("qna".equals(postType) ? normalizeMediaType(request.mediaType(), request.mediaUrl()) : null);
        post.setMediaUrl("qna".equals(postType) ? optional(request.mediaUrl(), 600) : null);
        post.setCaption("qna".equals(postType) ? required(request.questionDetail(), "질문 내용을 입력해주세요.", 2000) : required(request.caption(), "소개 내용을 입력해주세요.", 2000));
        post.setQuestionDetail("qna".equals(postType) ? required(request.questionDetail(), "질문 내용을 입력해주세요.", 3000) : null);
        post.setAttempted("qna".equals(postType) ? optional(request.attempted(), 1200) : null);
        post.setAnswerPreference("qna".equals(postType) ? optional(request.answerPreference(), 160) : null);
        post.setTagsJson(writeList(limitList(request.tags(), 8, 24)));
        post.setRouteJson(writeList(limitList(request.route(), 10, 40)));
        CommunityPostEntity saved = postRepository.save(post);
        syncMedia(saved, request);
        return toResponse(saved, userId);
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

    private void syncMedia(CommunityPostEntity post, CommunityPostRequest request) {
        List<String> replacedUrls = mediaRepository.findByPost_IdOrderBySortOrderAscIdAsc(post.getId()).stream()
                .map(CommunityPostMediaEntity::getStorageUrl)
                .filter((url) -> url != null && !url.equals(request.mediaUrl()))
                .toList();
        mediaRepository.deleteByPost_Id(post.getId());
        deleteMediaAfterCommit(replacedUrls);
        if (!"qna".equals(responsePostType(post))) return;

        String mediaType = normalizeMediaType(request.mediaType(), request.mediaUrl());
        String mediaUrl = optional(request.mediaUrl(), 600);
        if (mediaType == null || mediaUrl == null) return;
        if ("video".equals(mediaType) && (request.mediaDurationSeconds() == null || request.mediaDurationSeconds() >= 300)) {
            throw new IllegalArgumentException("동영상은 5분 미만만 업로드할 수 있습니다.");
        }

        CommunityPostMediaEntity media = new CommunityPostMediaEntity();
        media.setPost(post);
        media.setMediaType(mediaType);
        media.setStorageUrl(mediaUrl);
        media.setOriginalFilename(optional(request.mediaOriginalFilename(), 255));
        media.setMimeType(optional(request.mediaMimeType(), 120));
        media.setSizeBytes(request.mediaSizeBytes());
        media.setDurationSeconds(request.mediaDurationSeconds());
        media.setSortOrder(0);
        mediaRepository.save(media);
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
    public CommunityCommentReactionResponse toggleCommentLike(long userId, long postId, long commentId) {
        CommunityPostCommentEntity comment = requireComment(postId, commentId);
        if (commentLikeRepository.existsByComment_IdAndUser_Id(commentId, userId)) {
            commentLikeRepository.deleteByComment_IdAndUser_Id(commentId, userId);
            return new CommunityCommentReactionResponse(commentId, false, commentLikeRepository.countByComment_Id(commentId));
        }

        CommunityPostCommentLikeEntity like = new CommunityPostCommentLikeEntity();
        like.setComment(comment);
        like.setUser(requireUser(userId));
        commentLikeRepository.save(like);
        return new CommunityCommentReactionResponse(commentId, true, commentLikeRepository.countByComment_Id(commentId));
    }

    @Transactional
    public void deletePost(long userId, long postId) {
        CommunityPostEntity post = requirePost(postId);
        if (!post.getAuthor().getId().equals(userId)) {
            throw new IllegalArgumentException("내가 작성한 커뮤니티 글만 삭제할 수 있습니다.");
        }
        List<String> mediaUrls = mediaRepository.findByPost_IdOrderBySortOrderAscIdAsc(postId).stream()
                .map(CommunityPostMediaEntity::getStorageUrl)
                .toList();
        if (mediaUrls.isEmpty() && post.getMediaUrl() != null) mediaUrls = List.of(post.getMediaUrl());
        postRepository.delete(post);
        deleteMediaAfterCommit(mediaUrls);
    }

    private void deleteMediaAfterCommit(List<String> mediaUrls) {
        if (mediaUrls == null || mediaUrls.isEmpty()) return;
        Runnable cleanup = () -> mediaUrls.forEach(mediaStorageService::deleteByPublicUrl);
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            cleanup.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                cleanup.run();
            }
        });
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
        CommunityPostMediaEntity media = mediaRepository.findByPost_IdOrderBySortOrderAscIdAsc(post.getId())
                .stream()
                .findFirst()
                .orElse(null);

        return new CommunityPostResponse(
                post.getId(),
                responsePostType(post),
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
                media == null ? post.getMediaType() : media.getMediaType(),
                media == null ? post.getMediaUrl() : media.getStorageUrl(),
                post.getCaption(),
                post.getQuestionDetail(),
                post.getAttempted(),
                post.getAnswerPreference(),
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

    private String normalizeMediaType(String value, String mediaUrl) {
        String url = optional(mediaUrl, 600);
        if (url == null) return null;
        String type = value == null ? "" : value.trim().toLowerCase();
        if ("video".equals(type) || url.startsWith("data:video/")) return "video";
        if ("image".equals(type) || url.startsWith("data:image/")) return "image";
        if (url.startsWith("/uploads/")) return type.isBlank() ? "image" : type;
        return null;
    }

    private String normalizePostType(String value, String planId) {
        String type = value == null ? "" : value.trim().toLowerCase();
        if ("qna".equals(type) || "photo".equals(type) || "plan".equals(type)) return type;
        return optional(planId, 100) == null ? "photo" : "plan";
    }

    private String responsePostType(CommunityPostEntity post) {
        if (post.getQuestionDetail() != null && !post.getQuestionDetail().isBlank()) return "qna";
        String type = post.getPostType();
        if (type == null || type.isBlank()) return post.getPlan() == null ? "photo" : "plan";
        return type;
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
                commentLikeRepository.countByComment_Id(comment.getId()),
                viewerId != null && commentLikeRepository.existsByComment_IdAndUser_Id(comment.getId(), viewerId),
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
