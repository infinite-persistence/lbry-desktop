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

const DEBOUNCE_SCROLL_HANDLER_MS = 100;

type Props = {
  topLevelComments: Array<Comment>,
  commentsDisabledBySettings: boolean,
  fetchTopLevelComments: (string, number, number, number) => void,
  fetchReacts: (string) => Promise<any>,
  resetComments: (string) => void,
  uri: string,
  claimIsMine: boolean,
  myChannels: ?Array<ChannelClaim>,
  isFetchingComments: boolean,
  linkedComment: any,
  totalComments: number,
  totalTopLevelComments: number,
  fetchingChannels: boolean,
  reactionsById: ?{ [string]: { [REACTION_TYPES.LIKE | REACTION_TYPES.DISLIKE]: number } },
  commentIds: any,
  myReactionsByCommentId: any,
  activeChannelId: ?string,
  numPendingReactionFetch: number, // Number of fetched comments without a matching reactions-fetch.
};

function CommentList(props: Props) {
  const {
    fetchTopLevelComments,
    fetchReacts,
    resetComments,
    uri,
    topLevelComments,
    commentsDisabledBySettings,
    claimIsMine,
    myChannels,
    isFetchingComments,
    linkedComment,
    totalComments,
    totalTopLevelComments,
    fetchingChannels,
    reactionsById,
    commentIds,
    myReactionsByCommentId,
    activeChannelId,
    numPendingReactionFetch,
  } = props;
  const commentRef = React.useRef();
  const spinnerRef = React.useRef();
  const [sort, setSort] = usePersistedState(
    'comment-sort-by',
    ENABLE_COMMENT_REACTIONS ? SORT_BY.POPULARITY : SORT_BY.NEWEST
  );
  const [page, setPage] = React.useState(0);

  // Display comments immediately if not fetching reactions
  // If not, wait to show comments until reactions are fetched
  const [readyToDisplayComments, setReadyToDisplayComments] = React.useState(
    Boolean(reactionsById) || !ENABLE_COMMENT_REACTIONS
  );

  const linkedCommentId = linkedComment && linkedComment.comment_id;
  const hasNoComments = !totalComments;
  const moreBelow = totalTopLevelComments - topLevelComments.length > 0;

  console.log('myReactionsByCommentId:', myReactionsByCommentId);

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
      setReadyToDisplayComments(true); // @KP temp
    }
  }, [fetchTopLevelComments, uri, page, resetComments, sort]);

  useEffect(() => {
    if (commentIds && ENABLE_COMMENT_REACTIONS && !fetchingChannels) {
      let commentIdsPendingReactionFetch = commentIds;

      console.log('--------------------------');
      console.log('  commentIdsPendingReactionFetch:', commentIdsPendingReactionFetch);

      if (myReactionsByCommentId) {
        console.log('Filtering...');
        commentIdsPendingReactionFetch = commentIds.filter((commentId) => {
          return !myReactionsByCommentId[`${commentId}:${activeChannelId}`];
        });
      }

      console.log('  commentIdsPendingReactionFetch:', commentIdsPendingReactionFetch);

      if (commentIdsPendingReactionFetch.length !== 0) {
        fetchReacts(null, commentIdsPendingReactionFetch)
          .then(() => {
            setReadyToDisplayComments(true);
          })
          .catch(() => setReadyToDisplayComments(true));
      }
    }
  }, [commentIds, myReactionsByCommentId, fetchReacts, uri, numPendingReactionFetch, activeChannelId, fetchingChannels]);

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

      if (isInViewport) {
        if (topLevelComments.length < totalTopLevelComments) {
          setPage(page + 1);
        }
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
    totalTopLevelComments,
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
