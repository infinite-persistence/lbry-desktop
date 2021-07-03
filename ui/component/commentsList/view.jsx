// @flow
import * as REACTION_TYPES from 'constants/reactions';
import * as ICONS from 'constants/icons';
import { COMMENT_PAGE_SIZE_TOP_LEVEL, SORT_BY } from 'constants/comment';
import React, { useEffect } from 'react';
import classnames from 'classnames';
import CommentView from 'component/comment';
import Spinner from 'component/spinner';
import Button from 'component/button';
import Card from 'component/common/card';
import CommentCreate from 'component/commentCreate';
import usePersistedState from 'effects/use-persisted-state';
import { ENABLE_COMMENT_REACTIONS } from 'config';
import Empty from 'component/common/empty';
import debounce from 'util/debounce';

const DEBOUNCE_SCROLL_HANDLER_MS = 50;

type Props = {
  allCommentIds: any,
  topLevelComments: Array<Comment>,
  topLevelTotalPages: number,
  commentsDisabledBySettings: boolean,
  fetchTopLevelComments: (string, number, number, number) => void,
  fetchReacts: (Array<string>) => Promise<any>,
  resetComments: (string) => void,
  uri: string,
  claimIsMine: boolean,
  myChannels: ?Array<ChannelClaim>,
  isFetchingComments: boolean,
  linkedComment: any,
  totalComments: number,
  fetchingChannels: boolean,
  myReactsByCommentId: ?{ [string]: Array<string> }, // "CommentId:MyChannelId" -> reaction array (note the ID concatenation)
  othersReactsById: ?{ [string]: { [REACTION_TYPES.LIKE | REACTION_TYPES.DISLIKE]: number } },
  activeChannelId: ?string,
};

function CommentList(props: Props) {
  const {
    allCommentIds,
    fetchTopLevelComments,
    fetchReacts,
    resetComments,
    uri,
    topLevelComments,
    topLevelTotalPages,
    commentsDisabledBySettings,
    claimIsMine,
    myChannels,
    isFetchingComments,
    linkedComment,
    totalComments,
    fetchingChannels,
    myReactsByCommentId,
    othersReactsById,
    activeChannelId,
  } = props;

  const commentRef = React.useRef();
  const spinnerRef = React.useRef();
  const DEFAULT_SORT = ENABLE_COMMENT_REACTIONS ? SORT_BY.POPULARITY : SORT_BY.NEWEST;
  const [sort, setSort] = usePersistedState('comment-sort-by', DEFAULT_SORT);
  const [page, setPage] = React.useState(0);
  const totalFetchedComments = allCommentIds ? allCommentIds.length : 0;

  // Display comments immediately if not fetching reactions
  // If not, wait to show comments until reactions are fetched
  const [readyToDisplayComments, setReadyToDisplayComments] = React.useState(
    Boolean(othersReactsById) || !ENABLE_COMMENT_REACTIONS
  );

  const linkedCommentId = linkedComment && linkedComment.comment_id;
  const hasNoComments = !totalComments;
  const moreBelow = page < topLevelTotalPages;

  const isMyComment = (channelId: string): boolean => {
    if (myChannels != null && channelId != null) {
      for (let i = 0; i < myChannels.length; i++) {
        if (myChannels[i].claim_id === channelId) {
          return true;
        }
      }
    }
    return false;
  };

  function changeSort(newSort) {
    if (sort !== newSort) {
      setSort(newSort);
      setPage(0); // Invalidate existing comments
    }
  }

  // Reset comments
  useEffect(() => {
    if (page === 0) {
      resetComments(uri);
      setPage(1);
    }
  }, [page, uri, resetComments]);

  // Fetch top-level comments
  useEffect(() => {
    if (page !== 0) {
      fetchTopLevelComments(uri, page, COMMENT_PAGE_SIZE_TOP_LEVEL, sort);
    }
  }, [fetchTopLevelComments, uri, page, resetComments, sort]);

  // Fetch reacts
  useEffect(() => {
    if (totalFetchedComments > 0 && ENABLE_COMMENT_REACTIONS && !fetchingChannels) {
      let idsForReactionFetch;

      if (!othersReactsById || !myReactsByCommentId) {
        idsForReactionFetch = allCommentIds;
      } else {
        idsForReactionFetch = allCommentIds.filter((commentId) => {
          const key = activeChannelId ? `${commentId}:${activeChannelId}` : commentId;
          return !othersReactsById[key] || !myReactsByCommentId[key];
        });
      }

      if (idsForReactionFetch.length !== 0) {
        fetchReacts(idsForReactionFetch)
          .then(() => {
            setReadyToDisplayComments(true);
          })
          .catch(() => setReadyToDisplayComments(true));
      }
    }
  }, [
    totalFetchedComments,
    allCommentIds,
    othersReactsById,
    myReactsByCommentId,
    fetchReacts,
    uri,
    activeChannelId,
    fetchingChannels,
  ]);

  useEffect(() => {
    if (readyToDisplayComments && linkedCommentId && commentRef && commentRef.current) {
      commentRef.current.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -100);
    }
  }, [readyToDisplayComments, linkedCommentId]);

  useEffect(() => {
    const handleCommentScroll = debounce(() => {
      // $FlowFixMe
      const rect = spinnerRef.current.getBoundingClientRect();

      const isInViewport =
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        // $FlowFixMe
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        // $FlowFixMe
        rect.left <= (window.innerWidth || document.documentElement.clientWidth);

      if (isInViewport && page < topLevelTotalPages) {
        setPage(page + 1);
      }
    }, DEBOUNCE_SCROLL_HANDLER_MS);

    if (!isFetchingComments && readyToDisplayComments && moreBelow && spinnerRef && spinnerRef.current) {
      window.addEventListener('scroll', handleCommentScroll);
    }

    return () => window.removeEventListener('scroll', handleCommentScroll);
  }, [
    page,
    moreBelow,
    spinnerRef,
    isFetchingComments,
    readyToDisplayComments,
    topLevelComments.length,
    topLevelTotalPages,
  ]);

  function prepareComments(arrayOfComments, linkedComment /* , isFetchingComments */) {
    let orderedComments;

    if (linkedComment) {
      if (!linkedComment.parent_id) {
        orderedComments = arrayOfComments.filter((c) => c.comment_id !== linkedComment.comment_id);
        orderedComments.unshift(linkedComment);
      } else {
        const parentComment = arrayOfComments.find((c) => c.comment_id === linkedComment.parent_id);
        orderedComments = arrayOfComments.filter((c) => c.comment_id !== linkedComment.parent_id);

        if (parentComment) {
          orderedComments.unshift(parentComment);
        }
      }
    } else {
      orderedComments = arrayOfComments;
    }
    return orderedComments;
  }

  // // Default to newest first for apps that don't have comment reactions
  // const sortedComments = reactionsById
  //   ? sortComments({ comments: topLevelComments, reactionsById, sort, isMyComment })
  //   : [];
  // const displayedComments = readyToDisplayComments
  //   ? prepareComments(sortedComments, linkedComment).slice(start, end)
  //   : [];

  const displayedComments = readyToDisplayComments ? prepareComments(topLevelComments, linkedComment) : [];

  return (
    <Card
      title={
        totalComments > 0
          ? totalComments === 1
            ? __('1 comment')
            : __('%total_comments% comments', { total_comments: totalComments })
          : __('Leave a comment')
      }
      titleActions={
        <>
          {totalComments > 1 && ENABLE_COMMENT_REACTIONS && (
            <span className="comment__sort">
              <Button
                button="alt"
                label={__('Best')}
                icon={ICONS.BEST}
                iconSize={18}
                onClick={() => changeSort(SORT_BY.POPULARITY)}
                className={classnames(`button-toggle`, {
                  'button-toggle--active': sort === SORT_BY.POPULARITY,
                })}
              />
              <Button
                button="alt"
                label={__('Controversial')}
                icon={ICONS.CONTROVERSIAL}
                iconSize={18}
                onClick={() => changeSort(SORT_BY.CONTROVERSY)}
                className={classnames(`button-toggle`, {
                  'button-toggle--active': sort === SORT_BY.CONTROVERSY,
                })}
              />
              <Button
                button="alt"
                label={__('New')}
                icon={ICONS.NEW}
                iconSize={18}
                onClick={() => changeSort(SORT_BY.NEWEST)}
                className={classnames(`button-toggle`, {
                  'button-toggle--active': sort === SORT_BY.NEWEST,
                })}
              />
            </span>
          )}
          <Button
            button="alt"
            icon={ICONS.REFRESH}
            title={__('Refresh')}
            onClick={() => {
              setPage(0);
            }}
          />
        </>
      }
      actions={
        <>
          <CommentCreate uri={uri} />

          {!commentsDisabledBySettings && !isFetchingComments && hasNoComments && (
            <Empty padded text={__('That was pretty deep. What do you think?')} />
          )}

          <ul className="comments" ref={commentRef}>
            {topLevelComments &&
              displayedComments &&
              displayedComments.map((comment) => {
                return (
                  <CommentView
                    isTopLevel
                    threadDepth={3}
                    key={comment.comment_id}
                    uri={uri}
                    authorUri={comment.channel_url}
                    author={comment.channel_name}
                    claimId={comment.claim_id}
                    commentId={comment.comment_id}
                    message={comment.comment}
                    timePosted={comment.timestamp * 1000}
                    claimIsMine={claimIsMine}
                    commentIsMine={comment.channel_id && isMyComment(comment.channel_id)}
                    linkedComment={linkedComment}
                    isPinned={comment.is_pinned}
                    supportAmount={comment.support_amount}
                    numDirectReplies={comment.replies}
                  />
                );
              })}
          </ul>

          {(isFetchingComments || moreBelow) && (
            <div className="main--empty" ref={spinnerRef}>
              <Spinner type="small" />
            </div>
          )}
        </>
      }
    />
  );
}

export default CommentList;
